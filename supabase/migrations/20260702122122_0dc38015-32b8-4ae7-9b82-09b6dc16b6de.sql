
CREATE INDEX IF NOT EXISTS idx_courses_tenant_status_created ON public.courses (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_tenant_slug ON public.courses (tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_courses_tenant_students ON public.courses (tenant_id, students_count DESC) WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_enrollments_student_tenant ON public.enrollments (student_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_created ON public.enrollments (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sections_course_order ON public.sections (course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_lessons_section_order ON public.lessons (section_id, order_index);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_enrollment ON public.lesson_progress (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON public.lesson_progress (lesson_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_events_tenant_user_created ON public.xp_events (tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_reviews_course ON public.course_reviews (course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_questions_course ON public.course_questions (course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_tenant_status ON public.payment_requests (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_student ON public.payment_requests (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants (slug);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON public.tenant_members (user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_quiz ON public.quiz_attempts (student_id, quiz_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages (conversation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tenant_home_bundle(_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant public.tenants; _courses jsonb; _cc int; _ec int;
BEGIN
  SELECT * INTO _tenant FROM public.tenants WHERE slug = _slug;
  IF _tenant.id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) INTO _courses FROM (
    SELECT id, slug, title, short_description, description, cover_url, price, is_free,
           ad_style, students_count, total_duration_seconds, college_id, major_id, average_rating
    FROM public.courses WHERE tenant_id = _tenant.id AND status = 'published'
    ORDER BY students_count DESC NULLS LAST, created_at DESC LIMIT 6
  ) c;
  SELECT COUNT(*) INTO _cc FROM public.courses WHERE tenant_id = _tenant.id AND status = 'published';
  SELECT COUNT(*) INTO _ec FROM public.enrollments WHERE tenant_id = _tenant.id;
  RETURN jsonb_build_object('tenant', row_to_json(_tenant), 'courses', _courses,
    'stats', jsonb_build_object('courses_count', _cc, 'enrollments_count', _ec));
END $$;
GRANT EXECUTE ON FUNCTION public.tenant_home_bundle(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.tenant_courses_bundle(_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant public.tenants; _courses jsonb; _bundles jsonb; _colleges jsonb;
BEGIN
  SELECT * INTO _tenant FROM public.tenants WHERE slug = _slug;
  IF _tenant.id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) INTO _courses FROM (
    SELECT id, slug, title, short_description, description, cover_url, price, is_free,
           ad_style, students_count, total_duration_seconds, college_id, major_id, average_rating, created_at
    FROM public.courses WHERE tenant_id = _tenant.id AND status = 'published' ORDER BY created_at DESC
  ) c;
  SELECT COALESCE(jsonb_agg(row_to_json(b)), '[]'::jsonb) INTO _bundles FROM (
    SELECT * FROM public.course_bundles WHERE tenant_id = _tenant.id AND is_active = true ORDER BY created_at DESC
  ) b;
  SELECT COALESCE(jsonb_agg(row_to_json(cl)), '[]'::jsonb) INTO _colleges FROM (
    SELECT c.id, c.name, c.university_id FROM public.colleges c
    JOIN public.universities u ON u.id = c.university_id
    WHERE u.tenant_id = _tenant.id ORDER BY c.name
  ) cl;
  RETURN jsonb_build_object('tenant', row_to_json(_tenant), 'courses', _courses,
    'bundles', _bundles, 'colleges', _colleges);
END $$;
GRANT EXECUTE ON FUNCTION public.tenant_courses_bundle(text) TO anon, authenticated;
