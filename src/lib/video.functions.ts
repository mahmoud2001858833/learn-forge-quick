import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Video infrastructure — Worker-only flow.
 *
 * The Cloudflare Worker (R2_WORKER_URL) owns the R2 bucket; the app never
 * holds R2 credentials. Server functions here:
 *   1) authorize the caller,
 *   2) mint the R2 key + a `video_assets` row,
 *   3) tell the client which Worker URL to upload to,
 *   4) flip the row to ready/failed when the client reports back,
 *   5) hand out signed playback URLs.
 */

const SINGLE_SHOT_LIMIT = 100 * 1024 * 1024; // 100 MB

function r2KeyFor(tenantId: string, filename: string): string {
  const ext = (filename.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  return `tenants/${tenantId}/videos/${crypto.randomUUID()}.${ext}`;
}

async function ensureTenantAdmin(supabase: SupabaseClient, userId: string, tenantId: string) {
  const [{ data: tenant }, { data: member }, { data: superRole }] = await Promise.all([
    supabase.from("tenants").select("owner_id").eq("id", tenantId).maybeSingle(),
    supabase.from("tenant_members").select("role").eq("user_id", userId).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle(),
  ]);
  if (superRole) return;
  if (tenant?.owner_id === userId) return;
  if (member?.role === "owner" || member?.role === "admin") return;
  throw new Error("forbidden");
}

async function workerUrlFor(supabase: SupabaseClient, tenantId: string): Promise<string> {
  const { data: settings } = await supabase
    .from("platform_settings").select("r2_public_worker_url")
    .eq("tenant_id", tenantId).maybeSingle();
  const base = settings?.r2_public_worker_url || process.env.R2_WORKER_URL || "";
  if (!base) throw new Error("worker_url_not_configured");
  return base.replace(/\/$/, "");
}

export const initVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    tenantId: z.string().uuid(),
    filename: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(120),
    sizeBytes: z.number().int().positive(),
    durationSeconds: z.number().int().nonnegative().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureTenantAdmin(context.supabase, context.userId, data.tenantId);
    const workerUrl = await workerUrlFor(context.supabase, data.tenantId);
    const key = r2KeyFor(data.tenantId, data.filename);

    const { data: asset, error } = await context.supabase.from("video_assets").insert({
      tenant_id: data.tenantId,
      uploaded_by: context.userId,
      r2_key: key,
      status: "uploading",
      original_filename: data.filename,
      mime_type: data.mimeType,
      size_bytes: data.sizeBytes,
      duration_seconds: data.durationSeconds ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
    }).select("id").single();
    if (error) throw error;

    return {
      assetId: asset.id,
      key,
      workerUrl,
      mode: data.sizeBytes <= SINGLE_SHOT_LIMIT ? ("single" as const) : ("multipart" as const),
      partSize: 10 * 1024 * 1024,
    };
  });

export const completeVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: asset } = await context.supabase
      .from("video_assets").select("tenant_id").eq("id", data.assetId).maybeSingle();
    if (!asset) throw new Error("asset_not_found");
    await ensureTenantAdmin(context.supabase, context.userId, asset.tenant_id);
    await context.supabase.from("video_assets")
      .update({ status: "ready", upload_id: null })
      .eq("id", data.assetId);
    return { ok: true };
  });

export const abortVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: asset } = await context.supabase
      .from("video_assets").select("tenant_id").eq("id", data.assetId).maybeSingle();
    if (!asset) return { ok: true };
    await ensureTenantAdmin(context.supabase, context.userId, asset.tenant_id);
    await context.supabase.from("video_assets").update({ status: "failed" }).eq("id", data.assetId);
    return { ok: true };
  });

/**
 * Returns a Worker URL signed with the tenant's playback_token_secret.
 * Worker validates the HMAC + expiry + user binding before streaming from R2.
 */
export const getPlaybackUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: asset, error } = await context.supabase
      .from("video_assets").select("tenant_id, r2_key, status").eq("id", data.assetId).maybeSingle();
    if (error || !asset) throw new Error("asset_not_found");
    if (asset.status !== "ready") throw new Error("not_ready");

    const { data: member } = await context.supabase
      .from("tenant_members").select("user_id").eq("tenant_id", asset.tenant_id).eq("user_id", context.userId).maybeSingle();
    const { data: superRole } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "super_admin").maybeSingle();
    if (!member && !superRole) throw new Error("forbidden");

    const { data: settings } = await context.supabase
      .from("platform_settings").select("playback_token_secret, r2_public_worker_url")
      .eq("tenant_id", asset.tenant_id).maybeSingle();
    const workerBase = (settings?.r2_public_worker_url || process.env.R2_WORKER_URL || "").replace(/\/$/, "");
    if (!workerBase) throw new Error("worker_url_not_configured");

    const exp = Math.floor(Date.now() / 1000) + 60 * 60;
    const secret = settings?.playback_token_secret ?? "";
    let url: string;
    if (secret) {
      const payload = `${asset.r2_key}|${context.userId}|${exp}`;
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
      const sigHex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
      url = `${workerBase}/video/${asset.r2_key}?u=${context.userId}&e=${exp}&s=${sigHex}`;
    } else {
      url = `${workerBase}/video/${asset.r2_key}`;
    }
    return { url, expiresAt: exp };
  });
