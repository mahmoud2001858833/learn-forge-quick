CREATE TABLE IF NOT EXISTS public.video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.video_assets(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'finalize',
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_pending ON public.video_jobs (status, run_after);
CREATE INDEX IF NOT EXISTS idx_video_jobs_tenant ON public.video_jobs (tenant_id, created_at DESC);

GRANT SELECT ON public.video_jobs TO authenticated;
GRANT ALL ON public.video_jobs TO service_role;
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant staff read video jobs" ON public.video_jobs;
CREATE POLICY "tenant staff read video jobs"
ON public.video_jobs FOR SELECT TO authenticated
USING (
  public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','instructor']::tenant_role[])
);

CREATE TABLE IF NOT EXISTS public.job_locks (
  name text PRIMARY KEY,
  locked_until timestamptz NOT NULL,
  paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.job_locks TO service_role;
ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.acquire_job_lock(_name text, _seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ok boolean;
BEGIN
  INSERT INTO public.job_locks(name, locked_until)
  VALUES (_name, now() + make_interval(secs => _seconds))
  ON CONFLICT (name) DO UPDATE
    SET locked_until = EXCLUDED.locked_until, updated_at = now()
    WHERE public.job_locks.locked_until < now() AND public.job_locks.paused = false
  RETURNING true INTO ok;
  RETURN COALESCE(ok, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acquire_job_lock(text, int) FROM public;
REVOKE EXECUTE ON FUNCTION public.acquire_job_lock(text, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.acquire_job_lock(text, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_job_lock(text, int) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_video_jobs(_limit int DEFAULT 10)
RETURNS SETOF public.video_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.video_jobs j
  SET status = 'running', attempts = j.attempts + 1,
      locked_until = now() + interval '5 minutes', updated_at = now()
  WHERE j.id IN (
    SELECT id FROM public.video_jobs
    WHERE status IN ('queued','running')
      AND run_after <= now()
      AND (locked_until IS NULL OR locked_until < now())
      AND attempts < max_attempts
    ORDER BY run_after
    LIMIT GREATEST(1, LEAST(_limit, 25))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_video_jobs(int) FROM public;
REVOKE EXECUTE ON FUNCTION public.claim_video_jobs(int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_video_jobs(int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_video_jobs(int) TO service_role;