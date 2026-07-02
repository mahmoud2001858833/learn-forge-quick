
-- 1) platform_settings
DROP POLICY IF EXISTS "Public can read platform settings" ON public.platform_settings;
CREATE POLICY "Tenant members read platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE OR REPLACE VIEW public.platform_public_settings
WITH (security_invoker = false) AS
SELECT tenant_id, maintenance_mode, maintenance_message,
       marquee_enabled, marquee_text, marquee_color
FROM public.platform_settings;
GRANT SELECT ON public.platform_public_settings TO anon, authenticated;

-- Column-level: block anon entirely; block the secret from authenticated
REVOKE SELECT ON public.platform_settings FROM anon;
REVOKE SELECT (playback_token_secret) ON public.platform_settings FROM authenticated;

-- 2) coupons: remove public read
DROP POLICY IF EXISTS "Anyone can read active coupons for validation" ON public.coupons;

-- 3) live_sessions
DROP POLICY IF EXISTS "live_sessions_public_read" ON public.live_sessions;
CREATE POLICY "live_sessions_staff_or_enrolled_read"
  ON public.live_sessions FOR SELECT
  TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), tenant_id,
      ARRAY['owner','admin','instructor']::tenant_role[])
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.student_id = auth.uid()
        AND e.tenant_id = live_sessions.tenant_id
        AND (live_sessions.course_id IS NULL OR e.course_id = live_sessions.course_id)
    )
  );

CREATE OR REPLACE VIEW public.live_sessions_public
WITH (security_invoker = false) AS
SELECT id, tenant_id, course_id, title, description, provider,
       scheduled_at, duration_minutes, status, created_at
FROM public.live_sessions;
GRANT SELECT ON public.live_sessions_public TO anon, authenticated;

-- 4) user_gamification
DROP POLICY IF EXISTS "tenant members or self see gamification" ON public.user_gamification;
CREATE POLICY "self or tenant staff read gamification"
  ON public.user_gamification FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_tenant_role(auth.uid(), tenant_id,
        ARRAY['owner','admin','instructor']::tenant_role[])
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 5) user_badges
DROP POLICY IF EXISTS "Anyone reads user badges" ON public.user_badges;
CREATE POLICY "self or tenant staff read user badges"
  ON public.user_badges FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (tenant_id IS NOT NULL AND (
      public.has_tenant_role(auth.uid(), tenant_id,
        ARRAY['owner','admin','instructor']::tenant_role[])
      OR public.has_role(auth.uid(), 'super_admin')
    ))
  );

-- 6) Replace WITH CHECK (true)
DROP POLICY IF EXISTS "landing_events anyone insert" ON public.landing_events;
CREATE POLICY "landing_events public insert"
  ON public.landing_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (event_type IS NOT NULL AND length(event_type) <= 64);

DROP POLICY IF EXISTS "anyone can insert vitals" ON public.web_vitals;
CREATE POLICY "web_vitals public insert"
  ON public.web_vitals FOR INSERT
  TO anon, authenticated
  WITH CHECK (metric IS NOT NULL AND length(metric) <= 32);

-- 7) search_path on flagged functions
ALTER FUNCTION public.compute_level(integer) SET search_path = public;
ALTER FUNCTION public.xp_for_level(integer) SET search_path = public;

-- 8) Revoke EXECUTE from anon on all SECURITY DEFINER functions in public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- Re-grant on the intentionally public/authenticated ones
GRANT EXECUTE ON FUNCTION public.tenant_home_bundle(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_courses_bundle(text) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, uuid, tenant_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._is_tenant_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.course_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.section_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enrollment_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_course(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_payment_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payment_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_certificate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_coupon(uuid, text, numeric, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_overview_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_enrollments_by_day(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_revenue_by_day(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_top_courses(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_student_progress(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_leaderboard(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_gamification_summary(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.landing_events_summary(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_bank_question_into_quiz(uuid, uuid) TO authenticated;
