
-- Phase 20: Question Bank + Assignments

-- Question Bank
CREATE TABLE public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq','true_false','short_answer')),
  points integer NOT NULL DEFAULT 1,
  explanation text,
  tags text[] DEFAULT ARRAY[]::text[],
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_question_bank_tenant ON public.question_bank(tenant_id);
CREATE INDEX idx_question_bank_tags ON public.question_bank USING GIN(tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank TO authenticated;
GRANT ALL ON public.question_bank TO service_role;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant staff manage bank"
  ON public.question_bank FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = question_bank.tenant_id AND tm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = question_bank.tenant_id AND tm.user_id = auth.uid()));

CREATE TRIGGER trg_question_bank_updated BEFORE UPDATE ON public.question_bank
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bank choices
CREATE TABLE public.question_bank_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  choice_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_qbc_question ON public.question_bank_choices(question_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank_choices TO authenticated;
GRANT ALL ON public.question_bank_choices TO service_role;
ALTER TABLE public.question_bank_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant staff manage bank choices"
  ON public.question_bank_choices FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.question_bank qb
    JOIN public.tenant_members tm ON tm.tenant_id = qb.tenant_id
    WHERE qb.id = question_bank_choices.question_id AND tm.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.question_bank qb
    JOIN public.tenant_members tm ON tm.tenant_id = qb.tenant_id
    WHERE qb.id = question_bank_choices.question_id AND tm.user_id = auth.uid()
  ));

-- Assignments
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  due_at timestamptz,
  max_score integer NOT NULL DEFAULT 100,
  allow_late boolean NOT NULL DEFAULT true,
  attachment_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assignments_course ON public.assignments(course_id);
CREATE INDEX idx_assignments_tenant ON public.assignments(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage assignments"
  ON public.assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = assignments.tenant_id AND tm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = assignments.tenant_id AND tm.user_id = auth.uid()));

CREATE POLICY "enrolled students view assignments"
  ON public.assignments FOR SELECT TO authenticated
  USING (is_published = true AND EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = assignments.course_id AND e.student_id = auth.uid()
  ));

CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Submissions
CREATE TABLE public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  content text,
  file_url text,
  score integer,
  feedback text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','graded','returned')),
  submitted_at timestamptz DEFAULT now(),
  graded_at timestamptz,
  graded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);
CREATE INDEX idx_subs_assignment ON public.assignment_submissions(assignment_id);
CREATE INDEX idx_subs_student ON public.assignment_submissions(student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submissions TO authenticated;
GRANT ALL ON public.assignment_submissions TO service_role;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students manage own submissions"
  ON public.assignment_submissions FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "staff view tenant submissions"
  ON public.assignment_submissions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.tenant_members tm ON tm.tenant_id = a.tenant_id
    WHERE a.id = assignment_submissions.assignment_id AND tm.user_id = auth.uid()
  ));

CREATE POLICY "staff grade tenant submissions"
  ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.tenant_members tm ON tm.tenant_id = a.tenant_id
    WHERE a.id = assignment_submissions.assignment_id AND tm.user_id = auth.uid()
  ));

CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: import bank question into a quiz
CREATE OR REPLACE FUNCTION public.import_bank_question_into_quiz(_quiz_id uuid, _bank_question_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  qb record;
  new_q_id uuid;
  c record;
  max_order integer;
BEGIN
  SELECT * INTO qb FROM public.question_bank WHERE id = _bank_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'question not found'; END IF;

  -- Authorization: caller must be tenant member of the quiz tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.tenant_members tm ON tm.tenant_id = q.tenant_id
    WHERE q.id = _quiz_id AND tm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(MAX(order_index), 0) INTO max_order FROM public.quiz_questions WHERE quiz_id = _quiz_id;

  INSERT INTO public.quiz_questions(quiz_id, question_text, question_type, points, order_index, explanation)
  VALUES (_quiz_id, qb.question_text, qb.question_type, qb.points, max_order + 1, qb.explanation)
  RETURNING id INTO new_q_id;

  FOR c IN SELECT * FROM public.question_bank_choices WHERE question_id = _bank_question_id ORDER BY order_index LOOP
    INSERT INTO public.quiz_choices(question_id, choice_text, is_correct, order_index)
    VALUES (new_q_id, c.choice_text, c.is_correct, c.order_index);
  END LOOP;

  RETURN new_q_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_bank_question_into_quiz(uuid, uuid) TO authenticated;
