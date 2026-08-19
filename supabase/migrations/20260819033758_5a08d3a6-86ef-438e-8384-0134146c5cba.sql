-- ============ error_events ============
CREATE TABLE IF NOT EXISTS public.error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'client',
  message text NOT NULL,
  stack text,
  path text,
  tenant_slug text,
  user_id uuid,
  user_agent text,
  environment text NOT NULL DEFAULT 'production',
  count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open',
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_events_last_seen_idx ON public.error_events (last_seen DESC);
CREATE INDEX IF NOT EXISTS error_events_status_idx ON public.error_events (status, last_seen DESC);

GRANT SELECT ON public.error_events TO authenticated;
GRANT ALL ON public.error_events TO service_role;
ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admins read errors" ON public.error_events;
CREATE POLICY "super admins read errors" ON public.error_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super admins update errors" ON public.error_events;
CREATE POLICY "super admins update errors" ON public.error_events
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ============ service_health ============
CREATE TABLE IF NOT EXISTS public.service_health (
  name text PRIMARY KEY,
  status text NOT NULL DEFAULT 'unknown',
  latency_ms integer,
  error_message text,
  last_ok_at timestamptz,
  checked_at timestamptz NOT NULL DEFAULT now(),
  consecutive_failures integer NOT NULL DEFAULT 0
);

GRANT SELECT ON public.service_health TO authenticated;
GRANT ALL ON public.service_health TO service_role;
ALTER TABLE public.service_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read service health" ON public.service_health;
CREATE POLICY "members read service health" ON public.service_health
  FOR SELECT TO authenticated USING (true);

-- ============ record_error_event ============
CREATE OR REPLACE FUNCTION public.record_error_event(
  _source text,
  _message text,
  _stack text DEFAULT NULL,
  _path text DEFAULT NULL,
  _tenant_slug text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _environment text DEFAULT 'production'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _msg text := left(coalesce(_message, 'unknown error'), 500);
  _fp text;
  _id uuid;
BEGIN
  _fp := md5(coalesce(_source,'client') || '|' || _msg || '|' || coalesce(_path,''));

  INSERT INTO public.error_events (
    fingerprint, source, message, stack, path, tenant_slug, user_id, user_agent, environment
  ) VALUES (
    _fp,
    coalesce(_source, 'client'),
    _msg,
    left(_stack, 4000),
    left(_path, 300),
    left(_tenant_slug, 100),
    auth.uid(),
    left(_user_agent, 300),
    coalesce(_environment, 'production')
  )
  ON CONFLICT (fingerprint) DO UPDATE
    SET count = public.error_events.count + 1,
        last_seen = now(),
        status = CASE WHEN public.error_events.status = 'resolved' THEN 'open' ELSE public.error_events.status END,
        stack = COALESCE(public.error_events.stack, EXCLUDED.stack)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_error_event(text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_error_event(text,text,text,text,text,text,text) TO anon, authenticated, service_role;

-- ============ error_events_summary ============
CREATE OR REPLACE FUNCTION public.error_events_summary(_hours integer DEFAULT 24, _limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid, message text, source text, path text, tenant_slug text,
  count integer, status text, first_seen timestamptz, last_seen timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.message, e.source, e.path, e.tenant_slug,
         e.count, e.status, e.first_seen, e.last_seen
  FROM public.error_events e
  WHERE e.last_seen > now() - make_interval(hours => greatest(1, _hours))
    AND public.has_role(auth.uid(), 'super_admin')
  ORDER BY e.last_seen DESC
  LIMIT least(200, greatest(1, _limit));
$$;

REVOKE ALL ON FUNCTION public.error_events_summary(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.error_events_summary(integer,integer) TO authenticated, service_role;

-- ============ record_service_health ============
CREATE OR REPLACE FUNCTION public.record_service_health(
  _name text, _status text, _latency_ms integer DEFAULT NULL, _error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.service_health (name, status, latency_ms, error_message, checked_at, last_ok_at, consecutive_failures)
  VALUES (
    left(_name, 100), _status, _latency_ms, left(_error, 500), now(),
    CASE WHEN _status = 'ok' THEN now() ELSE NULL END,
    CASE WHEN _status = 'ok' THEN 0 ELSE 1 END
  )
  ON CONFLICT (name) DO UPDATE
    SET status = EXCLUDED.status,
        latency_ms = EXCLUDED.latency_ms,
        error_message = EXCLUDED.error_message,
        checked_at = now(),
        last_ok_at = CASE WHEN EXCLUDED.status = 'ok' THEN now() ELSE public.service_health.last_ok_at END,
        consecutive_failures = CASE WHEN EXCLUDED.status = 'ok' THEN 0 ELSE public.service_health.consecutive_failures + 1 END;
END;
$$;

REVOKE ALL ON FUNCTION public.record_service_health(text,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_service_health(text,text,integer,text) TO service_role;

-- ============ cleanup ============
CREATE OR REPLACE FUNCTION public.cleanup_monitoring()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.error_events WHERE last_seen < now() - interval '30 days';
  DELETE FROM public.perf_samples WHERE created_at < now() - interval '14 days';
  DELETE FROM public.web_vitals WHERE created_at < now() - interval '14 days';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_monitoring() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_monitoring() TO service_role;