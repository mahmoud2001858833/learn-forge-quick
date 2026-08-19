/**
 * Server-side error recording.
 *
 * Fire-and-forget PostgREST call into `record_error_event`; failures here are
 * swallowed because monitoring must never break a request.
 */

export type ServerErrorSample = {
  message: string;
  stack?: string | null;
  path?: string | null;
  tenantSlug?: string | null;
};

export function recordServerError(sample: ServerErrorSample): void {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error("[monitor] SUPABASE_SERVICE_ROLE_KEY missing — server error not recorded");
      return;
    }

    void fetch(`${url}/rest/v1/rpc/record_error_event`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        _source: "server",
        _message: String(sample.message ?? "unknown error").slice(0, 500),
        _stack: sample.stack ? String(sample.stack).slice(0, 4000) : null,
        _path: sample.path ? String(sample.path).slice(0, 300) : null,
        _tenant_slug: sample.tenantSlug ?? null,
        _user_agent: null,
        _environment: process.env.NODE_ENV === "production" ? "production" : "development",
      }),
    }).catch(() => {});
  } catch {
    /* never throw */
  }
}

/** Record the health of an external dependency (video Worker, etc). */
export function recordServiceHealth(name: string, status: "ok" | "down", latencyMs?: number, error?: string): void {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    void fetch(`${url}/rest/v1/rpc/record_service_health`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        _name: name,
        _status: status,
        _latency_ms: latencyMs ?? null,
        _error: error ? String(error).slice(0, 500) : null,
      }),
    }).catch(() => {});
  } catch {
    /* never throw */
  }
}
