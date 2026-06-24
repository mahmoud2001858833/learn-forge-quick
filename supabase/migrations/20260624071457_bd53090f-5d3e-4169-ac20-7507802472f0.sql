
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin');
CREATE TYPE public.tenant_role AS ENUM ('owner', 'instructor', 'student');
CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended', 'trial');
CREATE TYPE public.tenant_plan AS ENUM ('free', 'starter', 'pro', 'enterprise');
CREATE TYPE public.course_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.lesson_type AS ENUM ('video', 'text', 'pdf');

-- ============ updated_at helper ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ TENANTS ============
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan public.tenant_plan NOT NULL DEFAULT 'free',
  status public.tenant_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT SELECT ON public.tenants TO anon;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TENANT_MEMBERS ============
CREATE TABLE public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.tenant_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tenant_members_user ON public.tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant ON public.tenant_members(tenant_id);

CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = _user_id AND tenant_id = _tenant_id)
$$;
CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id UUID, _tenant_id UUID, _roles public.tenant_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = ANY(_roles))
$$;
CREATE OR REPLACE FUNCTION public.is_tenant_owner(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND owner_id = _user_id)
$$;

CREATE POLICY "tenants_select_public" ON public.tenants FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "tenants_insert_self" ON public.tenants FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "tenants_update_owner" ON public.tenants FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "tenants_delete_owner" ON public.tenants FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "members_select_self_or_staff" ON public.tenant_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','instructor']::public.tenant_role[]));
CREATE POLICY "members_insert_self_as_student" ON public.tenant_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'student');
CREATE POLICY "members_insert_by_owner" ON public.tenant_members FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id));
CREATE POLICY "members_update_owner" ON public.tenant_members FOR UPDATE TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id));
CREATE POLICY "members_delete_owner_or_self" ON public.tenant_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_tenant_owner(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.tenant_members (tenant_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_add_owner_member AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- ============ COURSES ============
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.course_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT SELECT ON public.courses TO anon;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_courses_tenant ON public.courses(tenant_id);
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "courses_select_published" ON public.courses FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "courses_select_staff" ON public.courses FOR SELECT TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','instructor']::public.tenant_role[]));
CREATE POLICY "courses_insert_staff" ON public.courses FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','instructor']::public.tenant_role[]));
CREATE POLICY "courses_update_staff" ON public.courses FOR UPDATE TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','instructor']::public.tenant_role[]))
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','instructor']::public.tenant_role[]));
CREATE POLICY "courses_delete_owner" ON public.courses FOR DELETE TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id));

-- ============ SECTIONS ============
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sections TO authenticated;
GRANT SELECT ON public.sections TO anon;
GRANT ALL ON public.sections TO service_role;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sections_course ON public.sections(course_id);

CREATE OR REPLACE FUNCTION public.course_tenant(_course_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.courses WHERE id = _course_id
$$;
CREATE OR REPLACE FUNCTION public.section_course(_section_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT course_id FROM public.sections WHERE id = _section_id
$$;

CREATE POLICY "sections_select_all" ON public.sections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sections_modify_staff" ON public.sections FOR ALL TO authenticated
  USING (public.has_tenant_role(auth.uid(), public.course_tenant(course_id), ARRAY['owner','instructor']::public.tenant_role[]))
  WITH CHECK (public.has_tenant_role(auth.uid(), public.course_tenant(course_id), ARRAY['owner','instructor']::public.tenant_role[]));

-- ============ ENROLLMENTS (before lessons - referenced in lessons policy) ============
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress NUMERIC(5,2) NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_course ON public.enrollments(course_id);

CREATE POLICY "enrollments_select_own_or_staff" ON public.enrollments FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','instructor']::public.tenant_role[]));
CREATE POLICY "enrollments_insert_self" ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "enrollments_delete_own_or_staff" ON public.enrollments FOR DELETE TO authenticated
  USING (student_id = auth.uid() OR public.is_tenant_owner(auth.uid(), tenant_id));

-- ============ LESSONS ============
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type public.lesson_type NOT NULL DEFAULT 'video',
  content_url TEXT,
  content_text TEXT,
  duration_seconds INT,
  order_index INT NOT NULL DEFAULT 0,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT SELECT ON public.lessons TO anon;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lessons_section ON public.lessons(section_id);

CREATE POLICY "lessons_select_preview" ON public.lessons FOR SELECT TO anon, authenticated USING (is_preview = true);
CREATE POLICY "lessons_select_enrolled_or_staff" ON public.lessons FOR SELECT TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), public.course_tenant(public.section_course(section_id)), ARRAY['owner','instructor']::public.tenant_role[])
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = public.section_course(section_id) AND e.student_id = auth.uid()
    )
  );
CREATE POLICY "lessons_modify_staff" ON public.lessons FOR ALL TO authenticated
  USING (public.has_tenant_role(auth.uid(), public.course_tenant(public.section_course(section_id)), ARRAY['owner','instructor']::public.tenant_role[]))
  WITH CHECK (public.has_tenant_role(auth.uid(), public.course_tenant(public.section_course(section_id)), ARRAY['owner','instructor']::public.tenant_role[]));

-- ============ LESSON_PROGRESS ============
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  watched_seconds INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_progress_enrollment ON public.lesson_progress(enrollment_id);
CREATE TRIGGER trg_progress_updated_at BEFORE UPDATE ON public.lesson_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enrollment_student(_enrollment_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT student_id FROM public.enrollments WHERE id = _enrollment_id
$$;

CREATE POLICY "progress_manage_own" ON public.lesson_progress FOR ALL TO authenticated
  USING (public.enrollment_student(enrollment_id) = auth.uid())
  WITH CHECK (public.enrollment_student(enrollment_id) = auth.uid());
