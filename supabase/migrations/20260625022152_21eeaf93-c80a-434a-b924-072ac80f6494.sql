
CREATE TYPE public.live_session_status AS ENUM ('scheduled','live','ended','cancelled');
CREATE TYPE public.live_session_provider AS ENUM ('zoom','google_meet','jitsi','teams','other');

CREATE TABLE public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  meeting_url TEXT NOT NULL,
  provider public.live_session_provider NOT NULL DEFAULT 'other',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  recording_url TEXT,
  status public.live_session_status NOT NULL DEFAULT 'scheduled',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_live_sessions_tenant_time ON public.live_sessions(tenant_id, scheduled_at DESC);

CREATE POLICY "live_sessions_public_read" ON public.live_sessions FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "live_sessions_staff_insert" ON public.live_sessions FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','instructor']::public.tenant_role[]));

CREATE POLICY "live_sessions_staff_update" ON public.live_sessions FOR UPDATE TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','instructor']::public.tenant_role[]))
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','instructor']::public.tenant_role[]));

CREATE POLICY "live_sessions_staff_delete" ON public.live_sessions FOR DELETE TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','instructor']::public.tenant_role[]));

CREATE TRIGGER trg_live_sessions_updated_at
BEFORE UPDATE ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
