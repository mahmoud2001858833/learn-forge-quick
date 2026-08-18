-- Single round-trip admin bundles: tenant + related lists in one call

CREATE OR REPLACE FUNCTION public.tenant_members_bundle(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t public.tenants;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO _t FROM public.tenants WHERE slug = _slug;
  IF _t.id IS NULL THEN RETURN NULL; END IF;
  IF NOT (public.is_tenant_owner(_uid, _t.id)
          OR public.has_tenant_role(_uid, _t.id, ARRAY['owner','admin','instructor']::tenant_role[])) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'tenant', to_jsonb(_t),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'user_id', m.user_id,
        'role', m.role,
        'created_at', m.created_at,
        'full_name', p.full_name
      ) ORDER BY m.created_at DESC)
      FROM public.tenant_members m
      LEFT JOIN public.profiles p ON p.id = m.user_id
      WHERE m.tenant_id = _t.id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tenant_members_bundle(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_members_bundle(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tenant_admin_courses_bundle(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t public.tenants;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO _t FROM public.tenants WHERE slug = _slug;
  IF _t.id IS NULL THEN RETURN NULL; END IF;
  IF NOT (public.is_tenant_owner(_uid, _t.id)
          OR public.has_tenant_role(_uid, _t.id, ARRAY['owner','admin','instructor']::tenant_role[])) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'tenant', to_jsonb(_t),
    'is_owner', (_t.owner_id = _uid),
    'courses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.title, 'status', c.status, 'price', c.price,
        'is_free', c.is_free, 'ad_style', c.ad_style, 'instructor_id', c.instructor_id,
        'approved_at', c.approved_at, 'rejection_reason', c.rejection_reason
      ) ORDER BY c.created_at DESC)
      FROM public.courses c
      WHERE c.tenant_id = _t.id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tenant_admin_courses_bundle(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_admin_courses_bundle(text) TO authenticated;

-- Supporting indexes for these lookups
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_created ON public.tenant_members (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_tenant_created ON public.courses (tenant_id, created_at DESC);