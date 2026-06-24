import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Phase 5 — Video infrastructure (R2 + Worker, multipart upload).
 *
 * Flow:
 *   1) client calls `initVideoUpload` with tenantId + filename → server creates an R2 multipart upload,
 *      inserts a `video_assets` row, returns { assetId, key, uploadId }.
 *   2) for each part the client calls `signVideoPart` → returns a presigned PUT URL.
 *      Client uploads the part directly to R2, capturing the ETag header.
 *   3) client calls `completeVideoUpload` with the collected parts → server finalizes the multipart upload
 *      and flips the video_asset to 'ready'.
 *   4) on abort, client calls `abortVideoUpload`.
 *   5) for playback, client calls `getPlaybackUrl` → returns a Worker URL with HMAC token.
 */

function r2KeyFor(tenantId: string, filename: string): string {
  const ext = (filename.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const rand = crypto.randomUUID();
  return `tenants/${tenantId}/videos/${rand}.${ext}`;
}

async function ensureTenantAdmin(supabase: ReturnType<typeof crypto.randomUUID> extends never ? never : import("@supabase/supabase-js").SupabaseClient, userId: string, tenantId: string) {
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

export const initVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    tenantId: z.string().uuid(),
    filename: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(120),
    sizeBytes: z.number().int().positive(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureTenantAdmin(context.supabase, context.userId, data.tenantId);
    const { signedR2Fetch } = await import("./r2-sigv4.server");
    const key = r2KeyFor(data.tenantId, data.filename);

    const res = await signedR2Fetch({
      method: "POST",
      key,
      query: { uploads: "" },
      contentType: data.mimeType,
    });
    if (!res.ok) throw new Error(`R2 init failed: ${res.status} ${await res.text()}`);
    const xml = await res.text();
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(xml)?.[1];
    if (!uploadId) throw new Error("R2 returned no UploadId");

    const { data: asset, error } = await context.supabase.from("video_assets").insert({
      tenant_id: data.tenantId,
      uploaded_by: context.userId,
      r2_key: key,
      upload_id: uploadId,
      status: "uploading",
      original_filename: data.filename,
      mime_type: data.mimeType,
      size_bytes: data.sizeBytes,
    }).select("id").single();
    if (error) throw error;
    return { assetId: asset.id, key, uploadId };
  });

export const signVideoPart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    assetId: z.string().uuid(),
    partNumber: z.number().int().min(1).max(10000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: asset, error } = await context.supabase
      .from("video_assets").select("tenant_id, r2_key, upload_id").eq("id", data.assetId).maybeSingle();
    if (error || !asset) throw new Error("asset_not_found");
    await ensureTenantAdmin(context.supabase, context.userId, asset.tenant_id);
    if (!asset.upload_id) throw new Error("no_upload_id");

    const { presignR2Url } = await import("./r2-sigv4.server");
    const url = await presignR2Url({
      method: "PUT",
      key: asset.r2_key,
      query: { partNumber: String(data.partNumber), uploadId: asset.upload_id },
      expiresSeconds: 3600,
    });
    return { url };
  });

export const completeVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    assetId: z.string().uuid(),
    parts: z.array(z.object({ partNumber: z.number().int().min(1), etag: z.string() })).min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: asset, error } = await context.supabase
      .from("video_assets").select("tenant_id, r2_key, upload_id").eq("id", data.assetId).maybeSingle();
    if (error || !asset) throw new Error("asset_not_found");
    await ensureTenantAdmin(context.supabase, context.userId, asset.tenant_id);
    if (!asset.upload_id) throw new Error("no_upload_id");

    const sorted = [...data.parts].sort((a, b) => a.partNumber - b.partNumber);
    const body =
      `<CompleteMultipartUpload>` +
      sorted.map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`).join("") +
      `</CompleteMultipartUpload>`;

    const { signedR2Fetch } = await import("./r2-sigv4.server");
    const res = await signedR2Fetch({
      method: "POST",
      key: asset.r2_key,
      query: { uploadId: asset.upload_id },
      body,
      contentType: "application/xml",
    });
    if (!res.ok) throw new Error(`R2 complete failed: ${res.status} ${await res.text()}`);

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
      .from("video_assets").select("tenant_id, r2_key, upload_id").eq("id", data.assetId).maybeSingle();
    if (!asset) return { ok: true };
    await ensureTenantAdmin(context.supabase, context.userId, asset.tenant_id);
    if (asset.upload_id) {
      const { signedR2Fetch } = await import("./r2-sigv4.server");
      await signedR2Fetch({
        method: "DELETE",
        key: asset.r2_key,
        query: { uploadId: asset.upload_id },
      }).catch(() => null);
    }
    await context.supabase.from("video_assets").update({ status: "failed" }).eq("id", data.assetId);
    return { ok: true };
  });

/**
 * Returns a Worker URL signed with the tenant's playback_token_secret.
 * Worker validates the HMAC + expiry + optional user binding before streaming from R2.
 */
export const getPlaybackUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: asset, error } = await context.supabase
      .from("video_assets").select("tenant_id, r2_key, status").eq("id", data.assetId).maybeSingle();
    if (error || !asset) throw new Error("asset_not_found");
    if (asset.status !== "ready") throw new Error("not_ready");
    // Caller must be tenant member to view
    const { data: member } = await context.supabase
      .from("tenant_members").select("user_id").eq("tenant_id", asset.tenant_id).eq("user_id", context.userId).maybeSingle();
    const { data: superRole } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "super_admin").maybeSingle();
    if (!member && !superRole) throw new Error("forbidden");

    const { data: settings } = await context.supabase
      .from("platform_settings").select("playback_token_secret, r2_public_worker_url")
      .eq("tenant_id", asset.tenant_id).maybeSingle();
    const workerBase = settings?.r2_public_worker_url ?? process.env.R2_WORKER_URL ?? "";
    if (!workerBase) throw new Error("worker_url_not_configured");

    const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1h
    const payload = `${asset.r2_key}|${context.userId}|${exp}`;
    const secret = settings?.playback_token_secret ?? "";
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    const sigHex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const url = `${workerBase.replace(/\/$/, "")}/v/${encodeURIComponent(asset.r2_key)}?u=${context.userId}&e=${exp}&s=${sigHex}`;
    return { url, expiresAt: exp };
  });
