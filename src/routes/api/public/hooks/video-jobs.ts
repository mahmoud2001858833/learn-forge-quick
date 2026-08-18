import { createFileRoute } from "@tanstack/react-router";

/**
 * Background worker for video post-upload processing.
 *
 * Invoked by pg_cron (every 2 minutes) and kicked opportunistically by the
 * client right after an upload finishes, so processing starts immediately
 * without blocking the UI.
 *
 * Safety rules implemented here:
 *  - bounded batch per run (BATCH_SIZE)
 *  - single-flight DB lease lock (acquire_job_lock)
 *  - idempotent progress marking (per-job status rows)
 *  - paused-state guard + bounded attempts with backoff
 */

const BATCH_SIZE = 10;
const LOCK_NAME = "video_jobs_worker";
const LOCK_SECONDS = 120;

type Job = {
  id: string;
  asset_id: string;
  tenant_id: string;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown> | null;
};

function rest(url: string, key: string, path: string, init: RequestInit = {}) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function run(): Promise<Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ ok: false, error: "not_configured" }, { status: 200 });

  // 1) Paused guard + single-flight lease
  const lockRes = await rest(url, key, "rpc/acquire_job_lock", {
    method: "POST",
    body: JSON.stringify({ _name: LOCK_NAME, _seconds: LOCK_SECONDS }),
  });
  const acquired = (await lockRes.json().catch(() => false)) === true;
  if (!acquired) return Response.json({ ok: true, skipped: "locked_or_paused" });

  // 2) Claim a bounded batch
  const claimRes = await rest(url, key, "rpc/claim_video_jobs", {
    method: "POST",
    body: JSON.stringify({ _limit: BATCH_SIZE }),
  });
  const jobs = (await claimRes.json().catch(() => [])) as Job[];
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return Response.json({ ok: true, processed: 0 });
  }

  const workerBase = (process.env.R2_WORKER_URL || process.env.VITE_R2_WORKER_URL || "").replace(/\/$/, "");
  let done = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const assetRes = await rest(
        url, key,
        `video_assets?id=eq.${job.asset_id}&select=id,r2_key,status,duration_seconds,thumbnail_key`,
      );
      const [asset] = (await assetRes.json().catch(() => [])) as Array<{
        id: string; r2_key: string; status: string; duration_seconds: number | null; thumbnail_key: string | null;
      }>;
      if (!asset) throw new Error("asset_not_found");

      // Idempotent: an already-ready asset simply closes its job.
      if (asset.status !== "ready") {
        // Verify the object actually landed in R2 before publishing it.
        if (workerBase && asset.r2_key) {
          const head = await fetch(`${workerBase}/head?key=${encodeURIComponent(asset.r2_key)}`, { method: "GET" })
            .catch(() => null);
          if (head && head.status === 404) throw new Error("object_missing_in_r2");
        }
        const patch: Record<string, unknown> = { status: "ready", upload_id: null, error_message: null };
        const p = job.payload ?? {};
        if (asset.duration_seconds == null && typeof p.durationSeconds === "number") {
          patch.duration_seconds = p.durationSeconds;
        }
        await rest(url, key, `video_assets?id=eq.${job.asset_id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
      }

      await rest(url, key, `video_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "done", locked_until: null, last_error: null, updated_at: new Date().toISOString() }),
      });
      done++;
    } catch (e) {
      failed++;
      const message = (e as Error)?.message ?? "unknown_error";
      const exhausted = job.attempts >= job.max_attempts;
      // Exponential backoff between attempts.
      const delayMs = Math.min(15 * 60_000, 30_000 * Math.pow(2, Math.max(0, job.attempts - 1)));
      await rest(url, key, `video_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: exhausted ? "failed" : "queued",
          last_error: message.slice(0, 500),
          locked_until: null,
          run_after: new Date(Date.now() + delayMs).toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      if (exhausted) {
        await rest(url, key, `video_assets?id=eq.${job.asset_id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status: "failed", error_message: message.slice(0, 500) }),
        });
      }
    }
  }

  // Release the lease so a follow-up kick can run right away.
  await rest(url, key, `job_locks?name=eq.${LOCK_NAME}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ locked_until: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });

  return Response.json({ ok: true, processed: jobs.length, done, failed });
}

export const Route = createFileRoute("/api/public/hooks/video-jobs")({
  server: {
    handlers: {
      POST: async () => {
        try {
          return await run();
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 200 });
        }
      },
      GET: async () => {
        try {
          return await run();
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 200 });
        }
      },
    },
  },
});
