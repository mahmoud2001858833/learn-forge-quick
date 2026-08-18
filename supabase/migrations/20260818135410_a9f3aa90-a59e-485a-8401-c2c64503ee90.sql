-- 1) store the page path for web vitals (the client already sends it)
ALTER TABLE public.web_vitals ADD COLUMN IF NOT EXISTS path text;
CREATE INDEX IF NOT EXISTS idx_web_vitals_created_at ON public.web_vitals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_vitals_tenant_metric ON public.web_vitals (tenant_slug, metric, created_at DESC);

-- 2) server-side timing samples (server functions, api routes, page requests)
CREATE TABLE IF NOT EXISTS public.perf_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'server_fn',
  name text NOT NULL,
  duration_ms numeric NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  error_message text,
  tenant_slug text,
  user_id uuid
);

GRANT ALL ON public.perf_samples TO service_role;
ALTER TABLE public.perf_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_samples super admin read"
  ON public.perf_samples FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_perf_samples_created_at ON public.perf_samples (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_samples_name ON public.perf_samples (name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_samples_tenant ON public.perf_samples (tenant_slug, created_at DESC);

-- 3) aggregation helpers, readable only by platform/tenant admins
CREATE OR REPLACE FUNCTION public.perf_vitals_summary(_tenant_slug text DEFAULT NULL, _hours int DEFAULT 24)
RETURNS TABLE (metric text, path text, samples bigint, p50 numeric, p75 numeric, p95 numeric, poor_ratio numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.metric,
         COALESCE(v.path, '/') AS path,
         count(*) AS samples,
         round(percentile_cont(0.5) WITHIN GROUP (ORDER BY v.value)::numeric, 1) AS p50,
         round(percentile_cont(0.75) WITHIN GROUP (ORDER BY v.value)::numeric, 1) AS p75,
         round(percentile_cont(0.95) WITHIN GROUP (ORDER BY v.value)::numeric, 1) AS p95,
         round((count(*) FILTER (WHERE v.rating = 'poor'))::numeric / GREATEST(count(*), 1), 3) AS poor_ratio
  FROM public.web_vitals v
  WHERE v.created_at >= now() - make_interval(hours => GREATEST(1, LEAST(_hours, 720)))
    AND (_tenant_slug IS NULL OR v.tenant_slug = _tenant_slug)
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        JOIN public.tenant_members m ON m.tenant_id = t.id
        WHERE t.slug = _tenant_slug AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
      )
      OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.slug = _tenant_slug AND t.owner_id = auth.uid())
    )
  GROUP BY v.metric, COALESCE(v.path, '/')
  ORDER BY count(*) DESC
  LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION public.perf_server_summary(_tenant_slug text DEFAULT NULL, _hours int DEFAULT 24)
RETURNS TABLE (name text, kind text, calls bigint, errors bigint, avg_ms numeric, p95_ms numeric, max_ms numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.name,
         max(s.kind) AS kind,
         count(*) AS calls,
         count(*) FILTER (WHERE s.status <> 'ok') AS errors,
         round(avg(s.duration_ms)::numeric, 1) AS avg_ms,
         round(percentile_cont(0.95) WITHIN GROUP (ORDER BY s.duration_ms)::numeric, 1) AS p95_ms,
         round(max(s.duration_ms)::numeric, 1) AS max_ms
  FROM public.perf_samples s
  WHERE s.created_at >= now() - make_interval(hours => GREATEST(1, LEAST(_hours, 720)))
    AND (_tenant_slug IS NULL OR s.tenant_slug = _tenant_slug OR s.tenant_slug IS NULL)
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        JOIN public.tenant_members m ON m.tenant_id = t.id
        WHERE t.slug = _tenant_slug AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
      )
      OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.slug = _tenant_slug AND t.owner_id = auth.uid())
    )
  GROUP BY s.name
  ORDER BY p95_ms DESC NULLS LAST
  LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION public.perf_vitals_summary(text, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.perf_server_summary(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perf_vitals_summary(text, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.perf_server_summary(text, int) TO authenticated, service_role;

-- keep the perf data small: purge samples older than 14 days every night
SELECT cron.unschedule('perf-samples-purge') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'perf-samples-purge');
SELECT cron.schedule('perf-samples-purge', '20 3 * * *', $$
  DELETE FROM public.perf_samples WHERE created_at < now() - interval '14 days';
  DELETE FROM public.web_vitals WHERE created_at < now() - interval '14 days';
$$);