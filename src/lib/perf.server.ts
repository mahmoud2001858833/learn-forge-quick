/**
 * Internal server-side performance logging.
 *
 * Writes timing samples straight to PostgREST with the service-role key —
 * no supabase-js import, so it stays cheap and never touches the client
 * bundle. Writes are fire-and-forget: monitoring must never break a request.
 */

const SLOW_MS = 300; // always record anything slower than this
const SAMPLE_RATE = 0.1; // otherwise keep 10% of calls

export type PerfSample = {
  kind?: "server_fn" | "api" | "request" | "job";
  name: string;
  durationMs: number;
  status?: "ok" | "error";
  errorMessage?: string | null;
  tenantSlug?: string | null;
  userId?: string | null;
};

export function recordTiming(sample: PerfSample): void {
  try {
    const isError = sample.status === "error";
    if (!isError && sample.durationMs < SLOW_MS && Math.random() > SAMPLE_RATE) return;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      // Fail loudly in logs instead of silently degrading to a weaker key.
      console.error("[perf] SUPABASE_SERVICE_ROLE_KEY missing — timing not recorded");
      return;
    }

    void fetch(`${url}/rest/v1/perf_samples`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        kind: sample.kind ?? "server_fn",
        name: sample.name.slice(0, 200),
        duration_ms: Math.round(sample.durationMs),
        status: sample.status ?? "ok",
        error_message: sample.errorMessage ? String(sample.errorMessage).slice(0, 500) : null,
        tenant_slug: sample.tenantSlug ?? null,
        user_id: sample.userId ?? null,
      }),
    }).catch(() => {});
  } catch {
    /* monitoring must never throw */
  }
}

/** Time an async block and log it. Returns the block's result. */
export async function timed<T>(name: string, fn: () => Promise<T>, kind: PerfSample["kind"] = "server_fn"): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await fn();
    recordTiming({ name, kind, durationMs: Date.now() - t0 });
    return out;
  } catch (e) {
    recordTiming({ name, kind, durationMs: Date.now() - t0, status: "error", errorMessage: (e as Error)?.message });
    throw e;
  }
}
