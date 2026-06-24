
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'admin';

CREATE TABLE public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  logo_url TEXT,
  country TEXT,
  city TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX idx_universities_tenant ON public.universities(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.universities TO authenticated;
GRANT ALL ON public.universities TO service_role;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read universities" ON public.universities FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "owners write universities" ON public.universities FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER update_universities_updated_at BEFORE UPDATE ON public.universities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, name)
);
CREATE INDEX idx_colleges_tenant ON public.colleges(tenant_id);
CREATE INDEX idx_colleges_university ON public.colleges(university_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.colleges TO authenticated;
GRANT ALL ON public.colleges TO service_role;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read colleges" ON public.colleges FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "owners write colleges" ON public.colleges FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER update_colleges_updated_at BEFORE UPDATE ON public.colleges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.majors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  years_count INT NOT NULL DEFAULT 4,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (college_id, name)
);
CREATE INDEX idx_majors_tenant ON public.majors(tenant_id);
CREATE INDEX idx_majors_college ON public.majors(college_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.majors TO authenticated;
GRANT ALL ON public.majors TO service_role;
ALTER TABLE public.majors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read majors" ON public.majors FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "owners write majors" ON public.majors FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER update_majors_updated_at BEFORE UPDATE ON public.majors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS major_id UUID REFERENCES public.majors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS study_year_number INT;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS major_id UUID REFERENCES public.majors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS year_number INT,
  ADD COLUMN IF NOT EXISTS semester TEXT;
