// Minimal AWS SigV4 signer for Cloudflare R2 (S3-compatible API).
// Server-only — uses process.env.* and Web Crypto.

const enc = new TextEncoder();

async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const buf = typeof data === "string" ? enc.encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
}

async function signingKey(secret: string, dateStamp: string, region: string, service: string) {
  const kDate = await hmac(enc.encode("AWS4" + secret), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  return kSigning;
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export function getR2Config(): R2Config {
  const cfg = {
    accountId: process.env.R2_ACCOUNT_ID ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET ?? "",
  };
  if (!cfg.accountId || !cfg.accessKeyId || !cfg.secretAccessKey || !cfg.bucket) {
    throw new Error("R2 credentials not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.");
  }
  return cfg;
}

function r2Host(accountId: string) {
  return `${accountId}.r2.cloudflarestorage.com`;
}

/**
 * Generate a presigned URL for an S3-style operation against R2.
 * `method` is the HTTP method; `query` is added to the query string (e.g. ?uploads, ?partNumber=&uploadId=).
 * Returns a fully signed URL that the browser can call directly.
 */
export async function presignR2Url(opts: {
  method: "GET" | "PUT" | "POST" | "DELETE";
  key: string;
  query?: Record<string, string>;
  expiresSeconds?: number;
}): Promise<string> {
  const cfg = getR2Config();
  const host = r2Host(cfg.accountId);
  const region = "auto";
  const service = "s3";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${cfg.accessKeyId}/${credentialScope}`;
  const expires = String(opts.expiresSeconds ?? 3600);

  const canonicalUri = `/${cfg.bucket}/${opts.key.split("/").map(encodeURIComponent).join("/")}`;
  const queryParams: Record<string, string> = {
    ...(opts.query ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expires,
    "X-Amz-SignedHeaders": "host",
  };
  const sortedKeys = Object.keys(queryParams).sort();
  const canonicalQuery = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = [opts.method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const key = await signingKey(cfg.secretAccessKey, dateStamp, region, service);
  const signature = hex(await hmac(key, stringToSign));

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/**
 * Make a signed request (server-to-R2) with Authorization header (not query).
 * Used by the server function to call R2 admin endpoints (initiate/complete multipart, abort, list).
 */
export async function signedR2Fetch(opts: {
  method: "GET" | "POST" | "PUT" | "DELETE";
  key: string;
  query?: Record<string, string>;
  body?: string;
  contentType?: string;
}): Promise<Response> {
  const cfg = getR2Config();
  const host = r2Host(cfg.accountId);
  const region = "auto";
  const service = "s3";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const body = opts.body ?? "";
  const payloadHash = await sha256Hex(body);
  const canonicalUri = `/${cfg.bucket}/${opts.key.split("/").map(encodeURIComponent).join("/")}`;
  const queryParams = opts.query ?? {};
  const sortedKeys = Object.keys(queryParams).sort();
  const canonicalQuery = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join("&");

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (opts.contentType) headers["content-type"] = opts.contentType;

  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headers[k]}`).join("\n") + "\n";
  const signedHeaders = sortedHeaderKeys.join(";");
  const canonicalRequest = [opts.method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const key = await signingKey(cfg.secretAccessKey, dateStamp, region, service);
  const signature = hex(await hmac(key, stringToSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}${canonicalUri}${canonicalQuery ? "?" + canonicalQuery : ""}`;
  const fetchHeaders: Record<string, string> = { Authorization: authorization, ...headers };
  return fetch(url, { method: opts.method, headers: fetchHeaders, body: body || undefined });
}
