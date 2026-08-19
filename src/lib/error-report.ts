/**
 * Client-side error reporting.
 *
 * Sends browser errors to `/api/public/hooks/errors`, which aggregates them by
 * fingerprint in the database. Reporting is fire-and-forget, deduplicated and
 * rate-limited so a render loop can never flood the endpoint.
 */

const ENDPOINT = "/api/public/hooks/errors";
const MAX_PER_SESSION = 25;
const DEDUPE_WINDOW_MS = 60_000;

let started = false;
let sent = 0;
const recent = new Map<string, number>();

function shouldSend(key: string): boolean {
  if (typeof window === "undefined") return false;
  if (sent >= MAX_PER_SESSION) return false;
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUPE_WINDOW_MS) return false;
  recent.set(key, now);
  sent += 1;
  return true;
}

export function reportClientError(error: unknown, context?: Record<string, unknown>) {
  try {
    const err = error as Error | undefined;
    const message = (err?.message ?? String(error ?? "unknown error")).slice(0, 500);
    if (!message || message === "undefined") return;

    const path = window.location.pathname;
    if (!shouldSend(`${message}|${path}`)) return;

    const body = JSON.stringify({
      source: "client",
      message,
      stack: (err?.stack ?? "").slice(0, 4000),
      path,
      tenant_slug: path.match(/^\/t\/([^/]+)/)?.[1] ?? null,
      user_agent: navigator.userAgent.slice(0, 300),
      context: context ?? null,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(ENDPOINT, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* reporting must never throw */
  }
}

/** Attach global listeners once, from the root component. */
export function initErrorReporting() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("error", (event) => {
    reportClientError((event as ErrorEvent).error ?? new Error((event as ErrorEvent).message), {
      kind: "window.onerror",
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError((event as PromiseRejectionEvent).reason, { kind: "unhandledrejection" });
  });
}
