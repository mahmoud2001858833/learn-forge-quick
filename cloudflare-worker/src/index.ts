/**
 * EduForge video Worker — handles uploads AND playback through R2 binding.
 *
 * Endpoints:
 *   POST   /upload?key=...&contentType=...            single-shot upload (≤100MB recommended)
 *   POST   /upload/start?key=...&contentType=...      begin multipart, returns { uploadId, key }
 *   PUT    /upload/part?key=...&uploadId=...&partNumber=N    upload one part, returns { partNumber, etag }
 *   POST   /upload/complete   body: { key, uploadId, parts:[{partNumber,etag}] }
 *   POST   /upload/abort      body: { key, uploadId }
 *   GET    /video/:key                                stream with Range support (HMAC optional)
 *   GET    /?key=...                                  same as /video/:key
 *   OPTIONS *                                         CORS
 *
 * Playback signature (optional): query u, e, s where s = HMAC-SHA256(`${key}|${u}|${e}`)
 * using the tenant's playback_token_secret. If `s` is absent, playback is allowed
 * (useful for public previews); if present, it must verify and not be expired.
 */

export interface Env {
  R2_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range, Authorization",
  "Access-Control-Expose-Headers": "ETag, Content-Range, Content-Length, Accept-Ranges",
};

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...CORS, ...(init.headers || {}) },
  });
}

function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain", ...CORS } });
}

const secretCache = new Map<string, { secret: string; at: number }>();
async function getTenantSecret(env: Env, tenantId: string): Promise<string | null> {
  const cached = secretCache.get(tenantId);
  if (cached && Date.now() - cached.at < 60_000) return cached.secret;
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/platform_settings?tenant_id=eq.${tenantId}&select=playback_token_secret`,
      { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { playback_token_secret: string }[];
    const secret = rows[0]?.playback_token_secret ?? null;
    if (secret) secretCache.set(tenantId, { secret, at: Date.now() });
    return secret;
  } catch {
    return null;
  }
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseRange(header: string): R2Range | undefined {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m) return undefined;
  const start = m[1] ? parseInt(m[1], 10) : undefined;
  const end = m[2] ? parseInt(m[2], 10) : undefined;
  if (start != null && end != null) return { offset: start, length: end - start + 1 };
  if (start != null) return { offset: start };
  if (end != null) return { suffix: end };
  return undefined;
}

// Keys must look like `tenants/<uuid>/...` to prevent arbitrary writes.
function validKey(key: string): boolean {
  return /^tenants\/[0-9a-f-]{36}\/[\w./-]+$/i.test(key) && !key.includes("..");
}

async function handleStream(req: Request, env: Env, key: string): Promise<Response> {
  if (!key) return text("Bad request", 400);
  const url = new URL(req.url);
  const u = url.searchParams.get("u");
  const e = url.searchParams.get("e");
  const s = url.searchParams.get("s");

  // If a signature is provided, verify it.
  if (s || e) {
    if (!u || !e || !s) return text("Bad signature", 400);
    const exp = parseInt(e, 10);
    if (!Number.isFinite(exp) || Date.now() / 1000 > exp) return text("Expired", 403);
    const tenantId = key.split("/")[1];
    if (!tenantId) return text("Bad key", 400);
    const secret = await getTenantSecret(env, tenantId);
    if (!secret) return text("Forbidden", 403);
    const expected = await hmacHex(secret, `${key}|${u}|${e}`);
    if (!timingSafeEqualHex(expected, s)) return text("Forbidden", 403);
  }

  const range = req.headers.get("range") ?? undefined;
  const obj = await env.R2_BUCKET.get(key, range ? { range: parseRange(range) } : undefined);
  if (!obj) return text("Not found", 404);

  const headers = new Headers(CORS);
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=3600");
  if (range && obj.range && "offset" in obj.range) {
    const total = obj.size;
    const start = obj.range.offset ?? 0;
    const len = obj.range.length ?? total - start;
    headers.set("content-range", `bytes ${start}-${start + len - 1}/${total}`);
    headers.set("content-length", String(len));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("content-length", String(obj.size));
  return new Response(obj.body, { status: 200, headers });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(req.url);
    const path = url.pathname;

    // ─── Single-shot upload ──────────────────────────────────────────────
    if (req.method === "POST" && path === "/upload") {
      const key = url.searchParams.get("key") ?? "";
      const contentType = url.searchParams.get("contentType") ?? "application/octet-stream";
      if (!validKey(key)) return text("Bad key", 400);
      if (!req.body) return text("Missing body", 400);
      await env.R2_BUCKET.put(key, req.body, { httpMetadata: { contentType } });
      return json({ ok: true, key });
    }

    // ─── Multipart: start ────────────────────────────────────────────────
    if (req.method === "POST" && path === "/upload/start") {
      const key = url.searchParams.get("key") ?? "";
      const contentType = url.searchParams.get("contentType") ?? "application/octet-stream";
      if (!validKey(key)) return text("Bad key", 400);
      const mpu = await env.R2_BUCKET.createMultipartUpload(key, { httpMetadata: { contentType } });
      return json({ uploadId: mpu.uploadId, key: mpu.key });
    }

    // ─── Multipart: upload one part ──────────────────────────────────────
    if (req.method === "PUT" && path === "/upload/part") {
      const key = url.searchParams.get("key") ?? "";
      const uploadId = url.searchParams.get("uploadId") ?? "";
      const partNumber = parseInt(url.searchParams.get("partNumber") ?? "0", 10);
      if (!validKey(key) || !uploadId || partNumber < 1) return text("Bad request", 400);
      if (!req.body) return text("Missing body", 400);
      const mpu = env.R2_BUCKET.resumeMultipartUpload(key, uploadId);
      const part = await mpu.uploadPart(partNumber, req.body);
      return json({ partNumber: part.partNumber, etag: part.etag });
    }

    // ─── Multipart: complete ─────────────────────────────────────────────
    if (req.method === "POST" && path === "/upload/complete") {
      const body = (await req.json()) as { key: string; uploadId: string; parts: { partNumber: number; etag: string }[] };
      if (!validKey(body.key) || !body.uploadId || !Array.isArray(body.parts)) return text("Bad request", 400);
      const mpu = env.R2_BUCKET.resumeMultipartUpload(body.key, body.uploadId);
      const sorted = [...body.parts].sort((a, b) => a.partNumber - b.partNumber);
      await mpu.complete(sorted);
      return json({ ok: true, key: body.key });
    }

    // ─── Multipart: abort ────────────────────────────────────────────────
    if (req.method === "POST" && path === "/upload/abort") {
      const body = (await req.json()) as { key: string; uploadId: string };
      if (!validKey(body.key) || !body.uploadId) return text("Bad request", 400);
      const mpu = env.R2_BUCKET.resumeMultipartUpload(body.key, body.uploadId);
      await mpu.abort();
      return json({ ok: true });
    }

    // ─── Playback ────────────────────────────────────────────────────────
    if (req.method === "GET" && path.startsWith("/v/")) {
      return handleStream(req, env, decodeURIComponent(path.slice(3)));
    }
    if (req.method === "GET" && path.startsWith("/video/")) {
      return handleStream(req, env, decodeURIComponent(path.slice("/video/".length)));
    }
    if (req.method === "GET" && (path === "/" || path === "")) {
      const key = url.searchParams.get("key") ?? "";
      if (key) return handleStream(req, env, key);
      return text("EduForge video worker", 200);
    }

    return text("Not found", 404);
  },
};
