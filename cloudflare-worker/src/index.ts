/**
 * EduForge video playback Worker.
 *
 * Bindings (set in wrangler.toml):
 *   - R2_BUCKET: R2 bucket binding (the same bucket used for multipart uploads)
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: to fetch per-tenant playback secret
 *
 * Route: GET /v/:key?u=<userId>&e=<exp>&s=<hmacHex>
 *   - Verifies HMAC-SHA256 of `${key}|${userId}|${exp}` using the tenant's playback_token_secret.
 *   - Tenant is inferred from the key prefix "tenants/<tenantId>/...".
 *   - Streams the object from R2 with Range support.
 */

export interface Env {
  R2_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const secretCache = new Map<string, { secret: string; at: number }>();
const TTL = 60_000; // 60s

async function getTenantSecret(env: Env, tenantId: string): Promise<string | null> {
  const cached = secretCache.get(tenantId);
  if (cached && Date.now() - cached.at < TTL) return cached.secret;
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/platform_settings?tenant_id=eq.${tenantId}&select=playback_token_secret`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as { playback_token_secret: string }[];
  const secret = rows[0]?.playback_token_secret ?? null;
  if (secret) secretCache.set(tenantId, { secret, at: Date.now() });
  return secret;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Range",
        },
      });
    }
    if (!url.pathname.startsWith("/v/")) return new Response("Not found", { status: 404 });

    const key = decodeURIComponent(url.pathname.slice("/v/".length));
    const u = url.searchParams.get("u") ?? "";
    const e = url.searchParams.get("e") ?? "";
    const s = url.searchParams.get("s") ?? "";
    if (!key || !u || !e || !s) return new Response("Bad request", { status: 400 });

    const exp = parseInt(e, 10);
    if (!Number.isFinite(exp) || Date.now() / 1000 > exp) return new Response("Expired", { status: 403 });

    const tenantId = key.split("/")[1];
    if (!tenantId) return new Response("Bad key", { status: 400 });

    const secret = await getTenantSecret(env, tenantId);
    if (!secret) return new Response("Forbidden", { status: 403 });

    const expected = await hmacHex(secret, `${key}|${u}|${e}`);
    if (!timingSafeEqualHex(expected, s)) return new Response("Forbidden", { status: 403 });

    const range = req.headers.get("range") ?? undefined;
    const obj = await env.R2_BUCKET.get(key, range ? { range: parseRange(range) } : undefined);
    if (!obj) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("accept-ranges", "bytes");
    headers.set("cache-control", "private, max-age=3600");
    headers.set("Access-Control-Allow-Origin", "*");
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
  },
};

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
