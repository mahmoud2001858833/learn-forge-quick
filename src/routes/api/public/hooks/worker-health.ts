import { createFileRoute } from "@tanstack/react-router";
import { recordServiceHealth } from "@/lib/monitor.server";

/**
 * Health probe for the external Cloudflare video Worker.
 *
 * Called by pg_cron (and opportunistically before large uploads). Stores the
 * result in `service_health` so the admin UI can show a live status badge and
 * the uploader can fall back when the Worker is down.
 */
const TIMEOUT_MS = 6_000;

async function probe(): Promise<Response> {
  const base = (process.env.R2_WORKER_URL || process.env.VITE_R2_WORKER_URL || "").replace(/\/$/, "");
  if (!base) {
    recordServiceHealth("video_worker", "down", undefined, "R2_WORKER_URL not configured");
    return Response.json({ status: "down", reason: "not_configured" });
  }

  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(base, { method: "GET", signal: controller.signal });
    const latency = Date.now() - t0;
    // Any HTTP answer means the Worker is reachable; only 5xx counts as down.
    if (res.status >= 500) {
      recordServiceHealth("video_worker", "down", latency, `HTTP ${res.status}`);
      return Response.json({ status: "down", httpStatus: res.status, latency });
    }
    recordServiceHealth("video_worker", "ok", latency);
    return Response.json({ status: "ok", httpStatus: res.status, latency });
  } catch (e) {
    recordServiceHealth("video_worker", "down", Date.now() - t0, (e as Error)?.message);
    return Response.json({ status: "down", error: (e as Error)?.message });
  } finally {
    clearTimeout(timer);
  }
}

export const Route = createFileRoute("/api/public/hooks/worker-health")({
  server: {
    handlers: {
      GET: () => probe(),
      POST: () => probe(),
    },
  },
});
