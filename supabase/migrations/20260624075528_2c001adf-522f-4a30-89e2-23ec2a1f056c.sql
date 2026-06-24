
ALTER TYPE public.course_status ADD VALUE IF NOT EXISTS 'pending_approval';

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS ad_style SMALLINT NOT NULL DEFAULT 1 CHECK (ad_style BETWEEN 1 AND 6),
  ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
  ADD COLUMN IF NOT EXISTS ai_image_prompt TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS total_duration_seconds INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS students_count INT NOT NULL DEFAULT 0;

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS content_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Backfill tenant_id on lessons from sections->courses
UPDATE public.lessons l
SET tenant_id = c.tenant_id
FROM public.sections s
JOIN public.courses c ON c.id = s.course_id
WHERE l.section_id = s.id AND l.tenant_id IS NULL;

-- =========== BUNDLES ===========
CREATE TABLE public.course_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bundles_tenant ON public.course_bundles(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_bundles TO authenticated;
GRANT SELECT ON public.course_bundles TO anon;
GRANT ALL ON public.course_bundles TO service_role;
ALTER TABLE public.course_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active bundles" ON public.course_bundles FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "owners manage bundles" ON public.course_bundles FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_bundles_updated_at BEFORE UPDATE ON public.course_bundles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bundle_courses (
  bundle_id UUID NOT NULL REFERENCES public.course_bundles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (bundle_id, course_id)
);
CREATE INDEX idx_bundle_courses_course ON public.bundle_courses(course_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bundle_courses TO authenticated;
GRANT SELECT ON public.bundle_courses TO anon;
GRANT ALL ON public.bundle_courses TO service_role;
ALTER TABLE public.bundle_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read bundle courses" ON public.bundle_courses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owners manage bundle courses" ON public.bundle_courses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_bundles b WHERE b.id = bundle_id AND (public.is_tenant_owner(auth.uid(), b.tenant_id) OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.course_bundles b WHERE b.id = bundle_id AND (public.is_tenant_owner(auth.uid(), b.tenant_id) OR public.has_role(auth.uid(), 'super_admin'))));

-- Approval helper RPC
CREATE OR REPLACE FUNCTION public.approve_course(_course_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant UUID;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.courses WHERE id = _course_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'course_not_found'; END IF;
  IF NOT (public.is_tenant_owner(auth.uid(), _tenant) OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.courses SET status = 'published', approved_at = now(), approved_by = auth.uid(), rejection_reason = NULL
  WHERE id = _course_id;
END $$;

CREATE OR REPLACE FUNCTION public.reject_course(_course_id UUID, _reason TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant UUID;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.courses WHERE id = _course_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'course_not_found'; END IF;
  IF NOT (public.is_tenant_owner(auth.uid(), _tenant) OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.courses SET status = 'draft', rejection_reason = _reason WHERE id = _course_id;
END $$;
