
-- Drop the views (flagged as SECURITY DEFINER by linter)
DROP VIEW IF EXISTS public.platform_public_settings;
DROP VIEW IF EXISTS public.live_sessions_public;

-- platform_settings: allow public SELECT rows (RLS), enforce safe columns via GRANTs
DROP POLICY IF EXISTS "Public reads platform settings row" ON public.platform_settings;
CREATE POLICY "Public reads platform settings row"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (true);
-- anon can only read the safe subset (no secret, no worker URL config)
GRANT SELECT (tenant_id, maintenance_mode, maintenance_message,
              marquee_enabled, marquee_text, marquee_color,
              allow_signups, chat_enabled, coupons_enabled,
              payment_cash_enabled, payment_bank_transfer_enabled,
              enable_referrals, referral_commission_percent)
  ON public.platform_settings TO anon;

-- live_sessions: allow public SELECT rows via RLS, but hide meeting/recording URLs from anon
DROP POLICY IF EXISTS "Public reads live session schedule" ON public.live_sessions;
CREATE POLICY "Public reads live session schedule"
  ON public.live_sessions FOR SELECT
  TO anon, authenticated
  USING (true);
-- anon: no meeting_url / recording_url
REVOKE SELECT ON public.live_sessions FROM anon;
GRANT SELECT (id, tenant_id, course_id, title, description, provider,
              scheduled_at, duration_minutes, status, created_at)
  ON public.live_sessions TO anon;
-- authenticated: only the enrolled/staff policy exposes meeting/recording URLs, but the
-- permissive SELECT USING(true) would leak them. Hide URLs from generic authenticated via
-- column privilege revocation; the staff/enrolled read still works via RLS + explicit column grant.
REVOKE SELECT (meeting_url, recording_url) ON public.live_sessions FROM authenticated;
-- Grant those columns back only to authenticated queries that pass the staff/enrolled policy.
-- Postgres has no per-policy column grants, so we expose these columns via a SECURITY INVOKER
-- function instead, which is subject to the staff/enrolled RLS policy on live_sessions.
CREATE OR REPLACE FUNCTION public.get_live_session_urls(_session_id uuid)
RETURNS TABLE(meeting_url text, recording_url text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT ls.meeting_url, ls.recording_url
  FROM public.live_sessions ls
  WHERE ls.id = _session_id;
$$;
GRANT SELECT (meeting_url, recording_url) ON public.live_sessions TO authenticated;
-- Ensure only the strict staff/enrolled policy is used for the URL columns by removing the
-- permissive public policy from authenticated (keep it for anon only).
DROP POLICY IF EXISTS "Public reads live session schedule" ON public.live_sessions;
CREATE POLICY "Anon reads live session schedule"
  ON public.live_sessions FOR SELECT
  TO anon
  USING (true);
GRANT EXECUTE ON FUNCTION public.get_live_session_urls(uuid) TO authenticated;
