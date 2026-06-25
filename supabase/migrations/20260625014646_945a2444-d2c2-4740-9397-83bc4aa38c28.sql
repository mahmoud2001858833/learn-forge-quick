
-- 1) profiles: replace blanket SELECT with self-only + tenant staff visibility
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;

CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_select_tenant_staff"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.tenant_members tm ON tm.tenant_id = e.tenant_id
    WHERE e.student_id = profiles.id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner','admin','instructor')
  )
);

-- 2) tenants: hide owner_id from anonymous visitors via column-level grants
REVOKE SELECT ON public.tenants FROM anon;
GRANT SELECT
  (id, slug, name, logo_url, primary_color, secondary_color, description,
   plan, status, created_at, updated_at, currency, welcome_message,
   activated_at, about_text, privacy_text, terms_text,
   contact_email, contact_phone, hero_image_url,
   custom_domain, custom_domain_verified)
ON public.tenants TO anon;

-- 3) active_sessions: stop publishing session tokens over realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.active_sessions;

-- 4) Revoke EXECUTE on SECURITY DEFINER functions from PUBLIC and anon
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
                   r.proname, r.args);
  END LOOP;
END $$;

-- 5) Revoke EXECUTE from authenticated on internal/trigger-only functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'on_enrollment_created','bump_question_answers','recompute_course_rating',
        'trg_course_reviews_aggregate','add_owner_as_member','handle_new_user',
        'rls_auto_enable','bump_global_logout','create_default_platform_settings',
        'award_badge','create_notification','log_activity','generate_referral_code',
        'trg_notify_enrollment','trg_notify_payment_request','trg_notify_payment_status',
        'trg_notify_badge','trg_notify_certificate','trg_notify_answer'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated',
                   r.proname, r.args);
  END LOOP;
END $$;
