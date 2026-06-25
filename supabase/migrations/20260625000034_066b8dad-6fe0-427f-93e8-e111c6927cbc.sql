
CREATE OR REPLACE FUNCTION public._is_tenant_admin(_tenant_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant_id AND user_id = _user_id AND role IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_overview_stats(_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public._is_tenant_admin(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'courses', (SELECT COUNT(*) FROM public.courses WHERE tenant_id = _tenant_id),
    'published_courses', (SELECT COUNT(*) FROM public.courses WHERE tenant_id = _tenant_id AND status = 'published'),
    'students', (SELECT COUNT(DISTINCT student_id) FROM public.enrollments WHERE tenant_id = _tenant_id),
    'enrollments', (SELECT COUNT(*) FROM public.enrollments WHERE tenant_id = _tenant_id),
    'active_enrollments', (SELECT COUNT(*) FROM public.enrollments WHERE tenant_id = _tenant_id AND status = 'active'),
    'revenue', (SELECT COALESCE(SUM(paid_amount), 0) FROM public.payment_requests WHERE tenant_id = _tenant_id AND status IN ('approved','partial')),
    'pending_payments', (SELECT COUNT(*) FROM public.payment_requests WHERE tenant_id = _tenant_id AND status = 'pending'),
    'certificates', (SELECT COUNT(*) FROM public.certificates WHERE tenant_id = _tenant_id),
    'avg_rating', (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) FROM public.course_reviews cr
                   JOIN public.courses c ON c.id = cr.course_id WHERE c.tenant_id = _tenant_id)
  ) INTO result;

  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.tenant_revenue_by_day(_tenant_id UUID, _days INTEGER DEFAULT 30)
RETURNS TABLE(day DATE, revenue NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._is_tenant_admin(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH days AS (
    SELECT generate_series((CURRENT_DATE - (_days - 1))::date, CURRENT_DATE, interval '1 day')::date AS d
  )
  SELECT d AS day,
    COALESCE(SUM(pr.paid_amount), 0)::numeric AS revenue
  FROM days
  LEFT JOIN public.payment_requests pr
    ON pr.tenant_id = _tenant_id
    AND pr.status IN ('approved','partial')
    AND DATE(pr.updated_at) = d
  GROUP BY d
  ORDER BY d;
END $$;

CREATE OR REPLACE FUNCTION public.tenant_enrollments_by_day(_tenant_id UUID, _days INTEGER DEFAULT 30)
RETURNS TABLE(day DATE, count INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._is_tenant_admin(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH days AS (
    SELECT generate_series((CURRENT_DATE - (_days - 1))::date, CURRENT_DATE, interval '1 day')::date AS d
  )
  SELECT d AS day,
    COUNT(e.id)::integer AS count
  FROM days
  LEFT JOIN public.enrollments e
    ON e.tenant_id = _tenant_id AND DATE(e.created_at) = d
  GROUP BY d
  ORDER BY d;
END $$;

CREATE OR REPLACE FUNCTION public.tenant_top_courses(_tenant_id UUID, _limit INTEGER DEFAULT 10)
RETURNS TABLE(course_id UUID, title TEXT, enrollments_count BIGINT, revenue NUMERIC, average_rating NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._is_tenant_admin(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT c.id, c.title,
    (SELECT COUNT(*) FROM public.enrollments e WHERE e.course_id = c.id) AS enrollments_count,
    COALESCE((SELECT SUM(pr.paid_amount) FROM public.payment_requests pr
              WHERE pr.course_id = c.id AND pr.status IN ('approved','partial')), 0)::numeric AS revenue,
    c.average_rating
  FROM public.courses c
  WHERE c.tenant_id = _tenant_id
  ORDER BY enrollments_count DESC, revenue DESC
  LIMIT _limit;
END $$;

CREATE OR REPLACE FUNCTION public.tenant_student_progress(_tenant_id UUID, _limit INTEGER DEFAULT 100)
RETURNS TABLE(student_id UUID, full_name TEXT, enrollments_count BIGINT, completed_count BIGINT, avg_progress NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._is_tenant_admin(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT e.student_id,
    p.full_name,
    COUNT(*) AS enrollments_count,
    COUNT(*) FILTER (WHERE e.status = 'completed' OR e.completed_at IS NOT NULL) AS completed_count,
    COALESCE(ROUND(AVG(e.progress)::numeric, 2), 0) AS avg_progress
  FROM public.enrollments e
  LEFT JOIN public.profiles p ON p.id = e.student_id
  WHERE e.tenant_id = _tenant_id
  GROUP BY e.student_id, p.full_name
  ORDER BY enrollments_count DESC
  LIMIT _limit;
END $$;
