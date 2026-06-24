
-- 1) lesson_comments
CREATE TABLE public.lesson_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.lesson_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lesson_comments_lesson ON public.lesson_comments(lesson_id);
CREATE INDEX idx_lesson_comments_parent ON public.lesson_comments(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_comments TO authenticated;
GRANT ALL ON public.lesson_comments TO service_role;
ALTER TABLE public.lesson_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read lesson comments" ON public.lesson_comments
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.sections s ON s.id = l.section_id
    JOIN public.enrollments e ON e.course_id = s.course_id
    WHERE l.id = lesson_comments.lesson_id AND e.student_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.sections s ON s.id = l.section_id
    JOIN public.courses c ON c.id = s.course_id
    JOIN public.tenant_members tm ON tm.tenant_id = c.tenant_id
    WHERE l.id = lesson_comments.lesson_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','instructor')
  )
);

CREATE POLICY "insert lesson comments" ON public.lesson_comments
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.sections s ON s.id = l.section_id
    JOIN public.enrollments e ON e.course_id = s.course_id
    WHERE l.id = lesson_comments.lesson_id AND e.student_id = auth.uid()
  )
);

CREATE POLICY "update own lesson comments" ON public.lesson_comments
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete lesson comments" ON public.lesson_comments
FOR DELETE TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.sections s ON s.id = l.section_id
    JOIN public.courses c ON c.id = s.course_id
    JOIN public.tenant_members tm ON tm.tenant_id = c.tenant_id
    WHERE l.id = lesson_comments.lesson_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')
  )
);

CREATE TRIGGER trg_lesson_comments_updated BEFORE UPDATE ON public.lesson_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) course_questions
CREATE TABLE public.course_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_answered BOOLEAN NOT NULL DEFAULT false,
  answers_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_course_questions_course ON public.course_questions(course_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_questions TO authenticated;
GRANT ALL ON public.course_questions TO service_role;
ALTER TABLE public.course_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read questions" ON public.course_questions
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = course_questions.course_id AND e.student_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.courses c JOIN public.tenant_members tm ON tm.tenant_id = c.tenant_id
    WHERE c.id = course_questions.course_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','instructor')
  )
);

CREATE POLICY "insert question" ON public.course_questions
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = course_questions.course_id AND e.student_id = auth.uid())
);

CREATE POLICY "update own question" ON public.course_questions
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete question" ON public.course_questions
FOR DELETE TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.courses c JOIN public.tenant_members tm ON tm.tenant_id = c.tenant_id
    WHERE c.id = course_questions.course_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')
  )
);

CREATE TRIGGER trg_course_questions_updated BEFORE UPDATE ON public.course_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) course_answers
CREATE TABLE public.course_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.course_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_instructor_answer BOOLEAN NOT NULL DEFAULT false,
  is_accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_course_answers_q ON public.course_answers(question_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_answers TO authenticated;
GRANT ALL ON public.course_answers TO service_role;
ALTER TABLE public.course_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read answers" ON public.course_answers
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.course_questions q
    WHERE q.id = course_answers.question_id AND (
      EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = q.course_id AND e.student_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.courses c JOIN public.tenant_members tm ON tm.tenant_id = c.tenant_id
                 WHERE c.id = q.course_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','instructor'))
    )
  )
);

CREATE POLICY "insert answer" ON public.course_answers
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.course_questions q
    WHERE q.id = course_answers.question_id AND (
      EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = q.course_id AND e.student_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.courses c JOIN public.tenant_members tm ON tm.tenant_id = c.tenant_id
                 WHERE c.id = q.course_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','instructor'))
    )
  )
);

CREATE POLICY "update own answer" ON public.course_answers
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete answer" ON public.course_answers
FOR DELETE TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.course_questions q
    JOIN public.courses c ON c.id = q.course_id
    JOIN public.tenant_members tm ON tm.tenant_id = c.tenant_id
    WHERE q.id = course_answers.question_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')
  )
);

CREATE TRIGGER trg_course_answers_updated BEFORE UPDATE ON public.course_answers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.bump_question_answers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.course_questions
       SET answers_count = answers_count + 1,
           is_answered = is_answered OR NEW.is_instructor_answer
     WHERE id = NEW.question_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.course_questions
       SET answers_count = GREATEST(answers_count - 1, 0)
     WHERE id = OLD.question_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_bump_question_answers
AFTER INSERT OR DELETE ON public.course_answers
FOR EACH ROW EXECUTE FUNCTION public.bump_question_answers();

-- 4) course_reviews
CREATE TABLE public.course_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL,
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);
CREATE INDEX idx_course_reviews_course ON public.course_reviews(course_id);
GRANT SELECT ON public.course_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_reviews TO authenticated;
GRANT ALL ON public.course_reviews TO service_role;
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read reviews" ON public.course_reviews
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "enrolled insert review" ON public.course_reviews
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND rating BETWEEN 1 AND 5
  AND EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = course_reviews.course_id AND e.student_id = auth.uid())
);

CREATE POLICY "update own review" ON public.course_reviews
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND rating BETWEEN 1 AND 5);

CREATE POLICY "delete review" ON public.course_reviews
FOR DELETE TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.courses c JOIN public.tenant_members tm ON tm.tenant_id = c.tenant_id
    WHERE c.id = course_reviews.course_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')
  )
);

CREATE TRIGGER trg_course_reviews_updated BEFORE UPDATE ON public.course_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recompute_course_rating(_course_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.courses c
  SET reviews_count = sub.cnt,
      average_rating = COALESCE(sub.avg, 0)
  FROM (
    SELECT COUNT(*)::int AS cnt, ROUND(AVG(rating)::numeric, 2) AS avg
    FROM public.course_reviews WHERE course_id = _course_id
  ) sub
  WHERE c.id = _course_id;
END $$;

CREATE OR REPLACE FUNCTION public.trg_course_reviews_aggregate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_course_rating(OLD.course_id);
  ELSE
    PERFORM public.recompute_course_rating(NEW.course_id);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_course_reviews_agg
AFTER INSERT OR UPDATE OR DELETE ON public.course_reviews
FOR EACH ROW EXECUTE FUNCTION public.trg_course_reviews_aggregate();
