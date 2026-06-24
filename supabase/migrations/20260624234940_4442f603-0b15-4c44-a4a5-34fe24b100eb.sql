-- ============ QUIZZES ============
CREATE TYPE public.quiz_question_type AS ENUM ('mcq', 'true_false');

CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INT NOT NULL DEFAULT 60,
  attempts_limit INT,
  time_limit_minutes INT,
  is_final BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant staff manage quizzes" ON public.quizzes FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id)
         OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin','instructor']::tenant_role[])
         OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id)
              OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin','instructor']::tenant_role[])
              OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Enrolled students read quizzes" ON public.quizzes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e
                 WHERE e.course_id = quizzes.course_id AND e.student_id = auth.uid() AND e.status = 'active'));

CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type public.quiz_question_type NOT NULL DEFAULT 'mcq',
  points INT NOT NULL DEFAULT 1,
  order_index INT NOT NULL DEFAULT 0,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant staff manage quiz questions" ON public.quiz_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND
    (public.is_tenant_owner(auth.uid(), q.tenant_id)
     OR public.has_tenant_role(auth.uid(), q.tenant_id, ARRAY['admin','instructor']::tenant_role[])
     OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND
    (public.is_tenant_owner(auth.uid(), q.tenant_id)
     OR public.has_tenant_role(auth.uid(), q.tenant_id, ARRAY['admin','instructor']::tenant_role[])
     OR public.has_role(auth.uid(), 'super_admin'))));

CREATE POLICY "Enrolled students read questions" ON public.quiz_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q JOIN public.enrollments e ON e.course_id = q.course_id
                 WHERE q.id = quiz_id AND e.student_id = auth.uid() AND e.status = 'active'));

CREATE TABLE public.quiz_choices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_choices TO authenticated;
GRANT ALL ON public.quiz_choices TO service_role;
ALTER TABLE public.quiz_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant staff manage choices" ON public.quiz_choices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_questions qq JOIN public.quizzes q ON q.id = qq.quiz_id
    WHERE qq.id = question_id AND
    (public.is_tenant_owner(auth.uid(), q.tenant_id)
     OR public.has_tenant_role(auth.uid(), q.tenant_id, ARRAY['admin','instructor']::tenant_role[])
     OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quiz_questions qq JOIN public.quizzes q ON q.id = qq.quiz_id
    WHERE qq.id = question_id AND
    (public.is_tenant_owner(auth.uid(), q.tenant_id)
     OR public.has_tenant_role(auth.uid(), q.tenant_id, ARRAY['admin','instructor']::tenant_role[])
     OR public.has_role(auth.uid(), 'super_admin'))));

CREATE POLICY "Enrolled students read choices" ON public.quiz_choices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_questions qq JOIN public.quizzes q ON q.id = qq.quiz_id
                 JOIN public.enrollments e ON e.course_id = q.course_id
                 WHERE qq.id = question_id AND e.student_id = auth.uid() AND e.status = 'active'));

CREATE OR REPLACE VIEW public.quiz_choices_public WITH (security_invoker = true) AS
  SELECT id, question_id, text, order_index FROM public.quiz_choices;
GRANT SELECT ON public.quiz_choices_public TO authenticated;

-- Attempts
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  score INT NOT NULL DEFAULT 0,
  max_score INT NOT NULL DEFAULT 0,
  percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own attempts, staff see tenant" ON public.quiz_attempts FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND
      (public.is_tenant_owner(auth.uid(), q.tenant_id)
       OR public.has_tenant_role(auth.uid(), q.tenant_id, ARRAY['admin','instructor']::tenant_role[])
       OR public.has_role(auth.uid(), 'super_admin')))
  );

CREATE POLICY "Students insert own attempts" ON public.quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- ============ CERTIFICATES ============
CREATE TABLE public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_number TEXT NOT NULL UNIQUE,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  tenant_name TEXT NOT NULL,
  final_score NUMERIC(5,2),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.certificates TO authenticated;
GRANT SELECT ON public.certificates TO anon;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public verify certificates" ON public.certificates FOR SELECT TO anon, authenticated USING (true);

-- ============ BADGES ============
CREATE TABLE public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'award',
  color TEXT NOT NULL DEFAULT '#F59E0B',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX badges_tenant_code_uniq ON public.badges (COALESCE(tenant_id::text,'global'), code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT SELECT ON public.badges TO anon;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads badges" ON public.badges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Tenant admins manage own badges" ON public.badges FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
    OR public.has_role(auth.uid(), 'super_admin')))
  WITH CHECK (tenant_id IS NOT NULL AND (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
    OR public.has_role(auth.uid(), 'super_admin')));

INSERT INTO public.badges (tenant_id, code, name, description, icon, color) VALUES
  (NULL, 'first_enrollment', 'البداية الموفّقة', 'أول تسجيل في دورة', 'sparkles', '#10B981'),
  (NULL, 'course_completed', 'منجِز', 'أكملت دورة كاملة', 'trophy', '#F59E0B'),
  (NULL, 'perfect_quiz', 'الإتقان', 'حصلت على درجة كاملة في اختبار', 'star', '#3B82F6'),
  (NULL, 'five_courses', 'متعطّش للمعرفة', 'أكملت ٥ دورات', 'graduation-cap', '#8B5CF6');

CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_badges_uniq ON public.user_badges (user_id, badge_id, COALESCE(tenant_id::text,'global'));

GRANT SELECT, INSERT ON public.user_badges TO authenticated;
GRANT SELECT ON public.user_badges TO anon;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads user badges" ON public.user_badges FOR SELECT TO anon, authenticated USING (true);

-- ============ Award badge RPC ============
CREATE OR REPLACE FUNCTION public.award_badge(_user_id UUID, _code TEXT, _tenant_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _badge_id UUID; _ub_id UUID; _count INT;
BEGIN
  SELECT id INTO _badge_id FROM public.badges
    WHERE code = _code AND (tenant_id = _tenant_id OR tenant_id IS NULL)
    ORDER BY tenant_id NULLS LAST LIMIT 1;
  IF _badge_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.user_badges (user_id, badge_id, tenant_id)
  VALUES (_user_id, _badge_id, _tenant_id)
  ON CONFLICT DO NOTHING RETURNING id INTO _ub_id;

  IF _code = 'course_completed' THEN
    SELECT COUNT(*) INTO _count FROM public.certificates WHERE student_id = _user_id;
    IF _count >= 5 THEN PERFORM public.award_badge(_user_id, 'five_courses', _tenant_id); END IF;
  END IF;

  RETURN _ub_id;
END $$;

-- ============ Issue certificate RPC ============
CREATE OR REPLACE FUNCTION public.issue_certificate(_enrollment_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _e public.enrollments;
  _course public.courses;
  _tenant public.tenants;
  _student_name TEXT;
  _cert_num TEXT;
  _cert_id UUID;
  _best_score NUMERIC;
  _existing UUID;
BEGIN
  SELECT * INTO _e FROM public.enrollments WHERE id = _enrollment_id;
  IF _e.id IS NULL THEN RAISE EXCEPTION 'enrollment_not_found'; END IF;

  IF auth.uid() <> _e.student_id
     AND NOT public.is_tenant_owner(auth.uid(), _e.tenant_id)
     AND NOT public.has_tenant_role(auth.uid(), _e.tenant_id, ARRAY['admin','instructor']::tenant_role[])
     AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO _existing FROM public.certificates WHERE enrollment_id = _enrollment_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  SELECT * INTO _course FROM public.courses WHERE id = _e.course_id;
  SELECT * INTO _tenant FROM public.tenants WHERE id = _e.tenant_id;
  SELECT COALESCE(full_name, 'الطالب') INTO _student_name FROM public.profiles WHERE id = _e.student_id;

  SELECT MAX(percent) INTO _best_score FROM public.quiz_attempts qa
    JOIN public.quizzes q ON q.id = qa.quiz_id
    WHERE qa.student_id = _e.student_id AND q.course_id = _e.course_id AND q.is_final = true;

  _cert_num := 'CERT-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text || _enrollment_id::text), 1, 10));

  INSERT INTO public.certificates (certificate_number, enrollment_id, tenant_id, student_id, course_id,
                                   student_name, course_title, tenant_name, final_score)
  VALUES (_cert_num, _enrollment_id, _e.tenant_id, _e.student_id, _e.course_id,
          _student_name, _course.title, _tenant.name, _best_score)
  RETURNING id INTO _cert_id;

  PERFORM public.award_badge(_e.student_id, 'course_completed', _e.tenant_id);
  RETURN _cert_id;
END $$;

-- ============ Submit quiz attempt RPC ============
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(_quiz_id UUID, _answers JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _quiz public.quizzes;
  _enrollment_id UUID;
  _attempts_count INT;
  _max_score INT := 0;
  _score INT := 0;
  _percent NUMERIC;
  _passed BOOLEAN;
  _attempt_id UUID;
  _q RECORD;
  _user_choice TEXT;
  _correct_id UUID;
BEGIN
  SELECT * INTO _quiz FROM public.quizzes WHERE id = _quiz_id AND is_active = true;
  IF _quiz.id IS NULL THEN RAISE EXCEPTION 'quiz_not_found'; END IF;

  SELECT id INTO _enrollment_id FROM public.enrollments
    WHERE course_id = _quiz.course_id AND student_id = auth.uid() AND status = 'active';
  IF _enrollment_id IS NULL THEN RAISE EXCEPTION 'not_enrolled'; END IF;

  IF _quiz.attempts_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO _attempts_count FROM public.quiz_attempts
      WHERE quiz_id = _quiz_id AND student_id = auth.uid();
    IF _attempts_count >= _quiz.attempts_limit THEN RAISE EXCEPTION 'attempts_exhausted'; END IF;
  END IF;

  FOR _q IN SELECT id, points FROM public.quiz_questions WHERE quiz_id = _quiz_id LOOP
    _max_score := _max_score + _q.points;
    _user_choice := _answers->>(_q.id::text);
    SELECT id::text INTO _correct_id FROM public.quiz_choices WHERE question_id = _q.id AND is_correct = true LIMIT 1;
    IF _user_choice IS NOT NULL AND _correct_id IS NOT NULL AND _user_choice = _correct_id::text THEN
      _score := _score + _q.points;
    END IF;
  END LOOP;

  _percent := CASE WHEN _max_score > 0 THEN ROUND(_score::numeric * 100 / _max_score, 2) ELSE 0 END;
  _passed := _percent >= _quiz.passing_score;

  INSERT INTO public.quiz_attempts (quiz_id, student_id, enrollment_id, score, max_score, percent, passed, answers, submitted_at)
  VALUES (_quiz_id, auth.uid(), _enrollment_id, _score, _max_score, _percent, _passed, _answers, now())
  RETURNING id INTO _attempt_id;

  IF _percent = 100 THEN
    PERFORM public.award_badge(auth.uid(), 'perfect_quiz', _quiz.tenant_id);
  END IF;

  IF _quiz.is_final AND _passed THEN
    PERFORM public.issue_certificate(_enrollment_id);
  END IF;

  RETURN _attempt_id;
END $$;

-- Enrollment created → first_enrollment badge
CREATE OR REPLACE FUNCTION public.on_enrollment_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_badge(NEW.student_id, 'first_enrollment', NEW.tenant_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enrollment_badge ON public.enrollments;
CREATE TRIGGER trg_enrollment_badge AFTER INSERT ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.on_enrollment_created();
