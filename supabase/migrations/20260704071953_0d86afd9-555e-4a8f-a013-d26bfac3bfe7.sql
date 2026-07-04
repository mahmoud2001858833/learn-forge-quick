
ALTER TABLE public.tenant_members
  ADD COLUMN IF NOT EXISTS applied_role public.tenant_role,
  ADD COLUMN IF NOT EXISTS application_note TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DROP POLICY IF EXISTS "members_insert_self_as_student" ON public.tenant_members;
CREATE POLICY "members_insert_self_student_or_pending"
  ON public.tenant_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role IN ('student', 'pending_instructor')
  );

CREATE OR REPLACE FUNCTION public.apply_to_tenant(
  _tenant_id UUID,
  _desired_role public.tenant_role,
  _note TEXT DEFAULT NULL
)
RETURNS public.tenant_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _existing public.tenant_members;
  _row public.tenant_members;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _desired_role NOT IN ('student', 'instructor') THEN
    RAISE EXCEPTION 'Invalid role for application';
  END IF;

  SELECT * INTO _existing FROM public.tenant_members
    WHERE tenant_id = _tenant_id AND user_id = _uid;
  IF FOUND THEN RETURN _existing; END IF;

  INSERT INTO public.tenant_members (tenant_id, user_id, role, applied_role, application_note)
  VALUES (
    _tenant_id, _uid,
    CASE WHEN _desired_role = 'student' THEN 'student'::public.tenant_role
         ELSE 'pending_instructor'::public.tenant_role END,
    _desired_role, _note
  )
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_to_tenant(UUID, public.tenant_role, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_to_tenant(UUID, public.tenant_role, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_instructor(_member_id UUID)
RETURNS public.tenant_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.tenant_members; _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _row FROM public.tenant_members WHERE id = _member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF NOT public.is_tenant_owner(_uid, _row.tenant_id) THEN
    RAISE EXCEPTION 'Only tenant owner can approve';
  END IF;
  UPDATE public.tenant_members
     SET role = 'instructor', approved_at = now(), approved_by = _uid,
         rejected_at = NULL, rejection_reason = NULL
   WHERE id = _member_id
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_instructor(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_instructor(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_instructor(_member_id UUID, _reason TEXT DEFAULT NULL)
RETURNS public.tenant_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.tenant_members; _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _row FROM public.tenant_members WHERE id = _member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF NOT public.is_tenant_owner(_uid, _row.tenant_id) THEN
    RAISE EXCEPTION 'Only tenant owner can reject';
  END IF;
  UPDATE public.tenant_members
     SET rejected_at = now(), rejection_reason = _reason, approved_at = NULL
   WHERE id = _member_id
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_instructor(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_instructor(UUID, TEXT) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_tenant_members_role
  ON public.tenant_members(tenant_id, role);
