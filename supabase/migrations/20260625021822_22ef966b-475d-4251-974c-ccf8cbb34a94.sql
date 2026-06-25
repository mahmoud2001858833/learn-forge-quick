
-- =========================================================
-- FUNNEL: enrollments -> started -> completed -> certified
-- =========================================================
CREATE OR REPLACE FUNCTION public.tenant_funnel_summary(_tenant_id uuid, _days int DEFAULT 90)
RETURNS TABLE(stage text, count bigint, percent numeric)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  total_enrolled bigint;
  total_started bigint;
  total_completed bigint;
  total_certified bigint;
BEGIN
  IF NOT public.has_tenant_role(auth.uid(), _tenant_id, ARRAY['owner','instructor']::public.tenant_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COUNT(*) INTO total_enrolled
  FROM public.enrollments e
  WHERE e.tenant_id = _tenant_id
    AND e.created_at >= now() - (_days || ' days')::interval;

  SELECT COUNT(DISTINCT e.id) INTO total_started
  FROM public.enrollments e
  JOIN public.lesson_progress lp ON lp.enrollment_id = e.id
  WHERE e.tenant_id = _tenant_id
    AND e.created_at >= now() - (_days || ' days')::interval
    AND lp.watched_seconds > 0;

  SELECT COUNT(*) INTO total_completed
  FROM public.enrollments e
  WHERE e.tenant_id = _tenant_id
    AND e.created_at >= now() - (_days || ' days')::interval
    AND e.completed_at IS NOT NULL;

  SELECT COUNT(*) INTO total_certified
  FROM public.certificates c
  JOIN public.enrollments e ON e.id = c.enrollment_id
  WHERE e.tenant_id = _tenant_id
    AND e.created_at >= now() - (_days || ' days')::interval;

  RETURN QUERY
  SELECT 'enrolled'::text, total_enrolled, 100::numeric
  UNION ALL SELECT 'started', total_started,
    CASE WHEN total_enrolled > 0 THEN ROUND(total_started::numeric * 100 / total_enrolled, 1) ELSE 0 END
  UNION ALL SELECT 'completed', total_completed,
    CASE WHEN total_enrolled > 0 THEN ROUND(total_completed::numeric * 100 / total_enrolled, 1) ELSE 0 END
  UNION ALL SELECT 'certified', total_certified,
    CASE WHEN total_enrolled > 0 THEN ROUND(total_certified::numeric * 100 / total_enrolled, 1) ELSE 0 END;
END;
$$;
REVOKE ALL ON FUNCTION public.tenant_funnel_summary(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.tenant_funnel_summary(uuid, int) TO authenticated;

-- =========================================================
-- AT-RISK STUDENTS: enrolled but inactive 14+ days, < 80% progress
-- =========================================================
CREATE OR REPLACE FUNCTION public.tenant_at_risk_students(_tenant_id uuid, _inactive_days int DEFAULT 14, _limit int DEFAULT 100)
RETURNS TABLE(
  enrollment_id uuid,
  student_id uuid,
  full_name text,
  course_title text,
  progress numeric,
  last_activity timestamptz,
  inactive_days int
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_tenant_role(auth.uid(), _tenant_id, ARRAY['owner','instructor']::public.tenant_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    e.id AS enrollment_id,
    e.student_id,
    p.full_name,
    c.title AS course_title,
    COALESCE(e.progress_percent, 0)::numeric AS progress,
    COALESCE(MAX(lp.updated_at), e.created_at) AS last_activity,
    EXTRACT(DAY FROM (now() - COALESCE(MAX(lp.updated_at), e.created_at)))::int AS inactive_days
  FROM public.enrollments e
  JOIN public.courses c ON c.id = e.course_id
  LEFT JOIN public.profiles p ON p.id = e.student_id
  LEFT JOIN public.lesson_progress lp ON lp.enrollment_id = e.id
  WHERE e.tenant_id = _tenant_id
    AND e.completed_at IS NULL
    AND COALESCE(e.progress_percent, 0) < 80
  GROUP BY e.id, e.student_id, p.full_name, c.title, e.progress_percent, e.created_at
  HAVING EXTRACT(DAY FROM (now() - COALESCE(MAX(lp.updated_at), e.created_at))) >= _inactive_days
  ORDER BY last_activity ASC
  LIMIT _limit;
END;
$$;
REVOKE ALL ON FUNCTION public.tenant_at_risk_students(uuid, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.tenant_at_risk_students(uuid, int, int) TO authenticated;

-- =========================================================
-- COHORT RETENTION: by enrollment week, % active in subsequent weeks
-- =========================================================
CREATE OR REPLACE FUNCTION public.tenant_cohort_retention(_tenant_id uuid, _weeks int DEFAULT 8)
RETURNS TABLE(
  cohort_week date,
  cohort_size bigint,
  week_1_active bigint,
  week_2_active bigint,
  week_3_active bigint,
  week_4_active bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_tenant_role(auth.uid(), _tenant_id, ARRAY['owner','instructor']::public.tenant_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      e.id,
      e.student_id,
      DATE_TRUNC('week', e.created_at)::date AS cohort,
      e.created_at AS enrolled_at
    FROM public.enrollments e
    WHERE e.tenant_id = _tenant_id
      AND e.created_at >= now() - (_weeks || ' weeks')::interval
  ),
  activity AS (
    SELECT b.cohort, b.id,
      MAX(CASE WHEN lp.updated_at BETWEEN b.enrolled_at AND b.enrolled_at + interval '7 days'  THEN 1 ELSE 0 END) AS w1,
      MAX(CASE WHEN lp.updated_at BETWEEN b.enrolled_at + interval '7 days'  AND b.enrolled_at + interval '14 days' THEN 1 ELSE 0 END) AS w2,
      MAX(CASE WHEN lp.updated_at BETWEEN b.enrolled_at + interval '14 days' AND b.enrolled_at + interval '21 days' THEN 1 ELSE 0 END) AS w3,
      MAX(CASE WHEN lp.updated_at BETWEEN b.enrolled_at + interval '21 days' AND b.enrolled_at + interval '28 days' THEN 1 ELSE 0 END) AS w4
    FROM base b
    LEFT JOIN public.lesson_progress lp ON lp.enrollment_id = b.id
    GROUP BY b.cohort, b.id
  )
  SELECT
    cohort AS cohort_week,
    COUNT(*)::bigint AS cohort_size,
    SUM(w1)::bigint AS week_1_active,
    SUM(w2)::bigint AS week_2_active,
    SUM(w3)::bigint AS week_3_active,
    SUM(w4)::bigint AS week_4_active
  FROM activity
  GROUP BY cohort
  ORDER BY cohort DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.tenant_cohort_retention(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.tenant_cohort_retention(uuid, int) TO authenticated;
