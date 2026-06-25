
-- Phase 19: Advanced Gamification (XP, Levels, Streaks, Leaderboards)

-- XP events log
CREATE TABLE public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  reason text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_xp_events_tenant_user ON public.xp_events(tenant_id, user_id);
CREATE INDEX idx_xp_events_created ON public.xp_events(created_at DESC);
GRANT SELECT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own xp events"
  ON public.xp_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = xp_events.tenant_id AND tm.user_id = auth.uid()
  ));

-- Per-tenant per-user gamification stats (aggregated)
CREATE TABLE public.user_gamification (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  total_xp integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX idx_user_gamification_xp ON public.user_gamification(tenant_id, total_xp DESC);
GRANT SELECT ON public.user_gamification TO authenticated;
GRANT ALL ON public.user_gamification TO service_role;
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members or self see gamification"
  ON public.user_gamification FOR SELECT TO authenticated
  USING (true);  -- public leaderboard; sensitive only to tenant

CREATE TRIGGER trg_user_gamification_updated
  BEFORE UPDATE ON public.user_gamification
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Level formula: level = floor(sqrt(xp / 100)) + 1
CREATE OR REPLACE FUNCTION public.compute_level(_xp integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(1, floor(sqrt(GREATEST(_xp, 0)::numeric / 100))::integer + 1);
$$;

-- XP needed to reach given level: (level-1)^2 * 100
CREATE OR REPLACE FUNCTION public.xp_for_level(_level integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT (GREATEST(_level, 1) - 1) * (GREATEST(_level, 1) - 1) * 100;
$$;

-- Award XP and update streak in one shot
CREATE OR REPLACE FUNCTION public.award_xp(
  _tenant_id uuid,
  _user_id uuid,
  _amount integer,
  _reason text,
  _meta jsonb DEFAULT '{}'::jsonb
) RETURNS public.user_gamification
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec public.user_gamification;
  today date := (now() AT TIME ZONE 'UTC')::date;
  new_streak integer;
BEGIN
  IF _amount IS NULL OR _amount = 0 THEN
    RAISE EXCEPTION 'amount must be non-zero';
  END IF;

  INSERT INTO public.xp_events(tenant_id, user_id, amount, reason, meta)
  VALUES (_tenant_id, _user_id, _amount, _reason, COALESCE(_meta, '{}'::jsonb));

  SELECT * INTO rec FROM public.user_gamification
    WHERE tenant_id = _tenant_id AND user_id = _user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_gamification(tenant_id, user_id, total_xp, current_streak, longest_streak, last_active_date)
    VALUES (_tenant_id, _user_id, GREATEST(_amount, 0), 1, 1, today)
    RETURNING * INTO rec;
    RETURN rec;
  END IF;

  IF rec.last_active_date = today THEN
    new_streak := rec.current_streak;
  ELSIF rec.last_active_date = today - 1 THEN
    new_streak := rec.current_streak + 1;
  ELSE
    new_streak := 1;
  END IF;

  UPDATE public.user_gamification SET
    total_xp = GREATEST(total_xp + _amount, 0),
    current_streak = new_streak,
    longest_streak = GREATEST(longest_streak, new_streak),
    last_active_date = today
  WHERE tenant_id = _tenant_id AND user_id = _user_id
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_xp(uuid, uuid, integer, text, jsonb) TO authenticated;

-- Leaderboard for a tenant (top N) with optional period filter
CREATE OR REPLACE FUNCTION public.tenant_leaderboard(
  _tenant_id uuid,
  _period text DEFAULT 'all',  -- 'week' | 'month' | 'all'
  _limit integer DEFAULT 50
) RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text,
  total_xp bigint,
  level integer,
  current_streak integer,
  rank bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  since timestamptz;
BEGIN
  IF _period = 'week' THEN since := now() - interval '7 days';
  ELSIF _period = 'month' THEN since := now() - interval '30 days';
  ELSE since := NULL;
  END IF;

  IF since IS NULL THEN
    RETURN QUERY
    SELECT g.user_id,
           COALESCE(p.full_name, 'مستخدم') as full_name,
           p.avatar_url,
           g.total_xp::bigint,
           public.compute_level(g.total_xp) as level,
           g.current_streak,
           ROW_NUMBER() OVER (ORDER BY g.total_xp DESC) as rank
    FROM public.user_gamification g
    LEFT JOIN public.profiles p ON p.id = g.user_id
    WHERE g.tenant_id = _tenant_id AND g.total_xp > 0
    ORDER BY g.total_xp DESC
    LIMIT _limit;
  ELSE
    RETURN QUERY
    WITH period_xp AS (
      SELECT e.user_id, SUM(e.amount)::bigint as xp
      FROM public.xp_events e
      WHERE e.tenant_id = _tenant_id AND e.created_at >= since
      GROUP BY e.user_id
      HAVING SUM(e.amount) > 0
    )
    SELECT px.user_id,
           COALESCE(p.full_name, 'مستخدم') as full_name,
           p.avatar_url,
           px.xp as total_xp,
           public.compute_level(COALESCE(g.total_xp, 0)) as level,
           COALESCE(g.current_streak, 0) as current_streak,
           ROW_NUMBER() OVER (ORDER BY px.xp DESC) as rank
    FROM period_xp px
    LEFT JOIN public.profiles p ON p.id = px.user_id
    LEFT JOIN public.user_gamification g ON g.user_id = px.user_id AND g.tenant_id = _tenant_id
    ORDER BY px.xp DESC
    LIMIT _limit;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_leaderboard(uuid, text, integer) TO authenticated, anon;

-- Get a user's current rank + stats in a tenant
CREATE OR REPLACE FUNCTION public.user_gamification_summary(_tenant_id uuid, _user_id uuid)
RETURNS TABLE(
  total_xp integer,
  level integer,
  xp_into_level integer,
  xp_for_next integer,
  current_streak integer,
  longest_streak integer,
  rank bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.user_gamification;
  lvl integer;
  cur_base integer;
  next_base integer;
  r bigint;
BEGIN
  SELECT * INTO g FROM public.user_gamification WHERE tenant_id = _tenant_id AND user_id = _user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 1, 0, 100, 0, 0, 0::bigint;
    RETURN;
  END IF;
  lvl := public.compute_level(g.total_xp);
  cur_base := public.xp_for_level(lvl);
  next_base := public.xp_for_level(lvl + 1);
  SELECT COUNT(*) + 1 INTO r FROM public.user_gamification
    WHERE tenant_id = _tenant_id AND total_xp > g.total_xp;
  RETURN QUERY SELECT g.total_xp, lvl, g.total_xp - cur_base, next_base - cur_base, g.current_streak, g.longest_streak, r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_gamification_summary(uuid, uuid) TO authenticated;

-- Auto-award XP triggers
-- 1) Lesson completion: +20 XP
CREATE OR REPLACE FUNCTION public.trg_award_xp_lesson_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t_id uuid;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.completed = true) OR
     (TG_OP = 'UPDATE' AND NEW.completed = true AND COALESCE(OLD.completed, false) = false) THEN
    SELECT c.tenant_id INTO t_id
    FROM public.lessons l
    JOIN public.sections s ON s.id = l.section_id
    JOIN public.courses c ON c.id = s.course_id
    WHERE l.id = NEW.lesson_id;
    IF t_id IS NOT NULL THEN
      PERFORM public.award_xp(t_id, NEW.user_id, 20, 'lesson_complete', jsonb_build_object('lesson_id', NEW.lesson_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_lesson_complete ON public.lesson_progress;
CREATE TRIGGER trg_xp_lesson_complete
  AFTER INSERT OR UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_xp_lesson_complete();

-- 2) Quiz passed: +50 XP
CREATE OR REPLACE FUNCTION public.trg_award_xp_quiz_passed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t_id uuid;
BEGIN
  IF NEW.passed = true AND (TG_OP = 'INSERT' OR COALESCE(OLD.passed, false) = false) THEN
    SELECT q.tenant_id INTO t_id FROM public.quizzes q WHERE q.id = NEW.quiz_id;
    IF t_id IS NOT NULL THEN
      PERFORM public.award_xp(t_id, NEW.student_id, 50, 'quiz_passed', jsonb_build_object('quiz_id', NEW.quiz_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_quiz_passed ON public.quiz_attempts;
CREATE TRIGGER trg_xp_quiz_passed
  AFTER INSERT OR UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_xp_quiz_passed();
