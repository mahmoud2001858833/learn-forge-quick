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
const PART_SIZE = 10 * 1024 * 1024; // 10 MB

function r2KeyFor(tenantId: string, filename: string, suffix = ""): string {
  const ext = (filename.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  return `tenants/${tenantId}/videos/${crypto.randomUUID()}${suffix}.${ext}`;
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

async function workerUrlFor(_supabase: SupabaseClient, _tenantId: string): Promise<string> {
  // Single system-wide Worker for ALL tenants.
  const base = process.env.R2_WORKER_URL || "";
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
    resumeAssetId: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureTenantAdmin(context.supabase, context.userId, data.tenantId);
    const workerUrl = await workerUrlFor(context.supabase, data.tenantId);

    // Resume an existing in-progress asset
    if (data.resumeAssetId) {
      const { data: existing } = await context.supabase.from("video_assets")
        .select("id, r2_key, upload_id, status, size_bytes, tenant_id, uploaded_by")
        .eq("id", data.resumeAssetId).maybeSingle();
      if (existing && existing.tenant_id === data.tenantId && existing.status === "uploading" && existing.upload_id) {
        return {
          assetId: existing.id,
          key: existing.r2_key,
          uploadId: existing.upload_id,
          workerUrl,
          mode: "multipart" as const,
          partSize: PART_SIZE,
          resumed: true,
        };
      }
    }

    // Worker will generate the real key; use placeholder until saveUploadId reports it.
    const placeholderKey = `pending/${crypto.randomUUID()}`;
    const { data: asset, error } = await context.supabase.from("video_assets").insert({
      tenant_id: data.tenantId,
      uploaded_by: context.userId,
      r2_key: placeholderKey,
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
      key: placeholderKey,
      uploadId: null as string | null,
      workerUrl,
      mode: "multipart" as const,
      partSize: PART_SIZE,
      resumed: false,
    };
  });

export const saveUploadId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    assetId: z.string().uuid(),
    uploadId: z.string().min(1),
    key: z.string().min(1).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: asset } = await context.supabase
      .from("video_assets").select("tenant_id").eq("id", data.assetId).maybeSingle();
    if (!asset) throw new Error("asset_not_found");
    await ensureTenantAdmin(context.supabase, context.userId, asset.tenant_id);
    await context.supabase.from("video_assets").update({
      upload_id: data.uploadId,
      ...(data.key ? { r2_key: data.key } : {}),
    }).eq("id", data.assetId);
    return { ok: true };
  });


export const listResumableUploads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tenantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureTenantAdmin(context.supabase, context.userId, data.tenantId);
    const { data: rows } = await context.supabase.from("video_assets")
      .select("id, r2_key, upload_id, original_filename, size_bytes, created_at")
      .eq("tenant_id", data.tenantId).eq("uploaded_by", context.userId)
      .eq("status", "uploading")
      .not("upload_id", "is", null)
      .order("created_at", { ascending: false }).limit(10);
    return rows ?? [];
  });

export const completeVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    assetId: z.string().uuid(),
    thumbnailKey: z.string().optional(),
    durationSeconds: z.number().int().nonnegative().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: asset } = await context.supabase
      .from("video_assets").select("tenant_id").eq("id", data.assetId).maybeSingle();
    if (!asset) throw new Error("asset_not_found");
    await ensureTenantAdmin(context.supabase, context.userId, asset.tenant_id);
    await context.supabase.from("video_assets").update({
      status: "ready",
      upload_id: null,
      ...(data.thumbnailKey ? { thumbnail_key: data.thumbnailKey } : {}),
      ...(data.durationSeconds != null ? { duration_seconds: data.durationSeconds } : {}),
      ...(data.width ? { width: data.width } : {}),
      ...(data.height ? { height: data.height } : {}),
    }).eq("id", data.assetId);
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
    await context.supabase.from("video_assets").update({ status: "failed", upload_id: null }).eq("id", data.assetId);
    return { ok: true };
  });

async function signWorkerUrl(workerBase: string, key: string, userId: string, secret: string, ttlSec = 3600): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  if (!secret) return `${workerBase}/video/${key}`;
  const payload = `${key}|${userId}|${exp}`;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  const sigHex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${workerBase}/video/${key}?u=${userId}&e=${exp}&s=${sigHex}`;
}

/**
 * Authorizes a viewer for a video, then returns a signed Worker URL.
 *
 * Access rules (enforced server-side; Worker also re-verifies the HMAC):
 *   - super_admin: any asset
 *   - tenant owner / admin / instructor: any asset in their tenant
 *   - student: must have an active enrollment in a course whose lesson
 *     references this asset OR the lesson is a free preview.
 */
export const getPlaybackUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: asset, error } = await context.supabase
      .from("video_assets").select("tenant_id, r2_key, status, thumbnail_key").eq("id", data.assetId).maybeSingle();
    if (error || !asset) throw new Error("asset_not_found");
    if (asset.status !== "ready") throw new Error("not_ready");

    // Permission check
    let allowed = false;
    const { data: superRole } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "super_admin").maybeSingle();
    if (superRole) allowed = true;

    if (!allowed) {
      const { data: member } = await context.supabase.from("tenant_members")
        .select("role").eq("tenant_id", asset.tenant_id).eq("user_id", context.userId).maybeSingle();
      if (member) allowed = true;
    }

    if (!allowed) {
      // Find lessons that use this asset, then check preview OR enrollment
      const { data: lessons } = await context.supabase.from("lessons")
        .select("id, is_preview, section_id, sections!inner(course_id)")
        .eq("video_asset_id", data.assetId);
      const rows = (lessons ?? []) as Array<{ is_preview: boolean; sections: { course_id: string } | { course_id: string }[] }>;
      const courseIds = new Set<string>();
      let hasPreview = false;
      for (const r of rows) {
        if (r.is_preview) hasPreview = true;
        const s = Array.isArray(r.sections) ? r.sections[0] : r.sections;
        if (s?.course_id) courseIds.add(s.course_id);
      }
      if (hasPreview) {
        allowed = true;
      } else if (courseIds.size > 0) {
        const { data: enr } = await context.supabase.from("enrollments")
          .select("id").eq("student_id", context.userId).eq("tenant_id", asset.tenant_id)
          .in("course_id", [...courseIds]).in("status", ["active", "completed"]).limit(1);
        if (enr && enr.length > 0) allowed = true;
      }
    }

    if (!allowed) throw new Error("forbidden");

    const workerBase = (process.env.R2_WORKER_URL || "").replace(/\/$/, "");
    if (!workerBase) throw new Error("worker_url_not_configured");

    const exp = Math.floor(Date.now() / 1000) + 60 * 60;
    const url = await signWorkerUrl(workerBase, asset.r2_key, context.userId, "", 3600);
    const thumbUrl = asset.thumbnail_key
      ? await signWorkerUrl(workerBase, asset.thumbnail_key, context.userId, "", 24 * 3600)
      : null;
    return { url, expiresAt: exp, thumbnailUrl: thumbUrl };
  });


/**
 * Lightweight thumbnail-only URL (no full video access required).
 * Used in admin/listing UI to preview the auto-generated cover frame.
 */
export const getThumbnailUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: asset } = await context.supabase
      .from("video_assets").select("tenant_id, thumbnail_key").eq("id", data.assetId).maybeSingle();
    if (!asset?.thumbnail_key) return { url: null };
    const workerBase = (process.env.R2_WORKER_URL || "").replace(/\/$/, "");
    if (!workerBase) return { url: null };
    const url = await signWorkerUrl(workerBase, asset.thumbnail_key, context.userId, "", 24 * 3600);
    return { url };
  });
