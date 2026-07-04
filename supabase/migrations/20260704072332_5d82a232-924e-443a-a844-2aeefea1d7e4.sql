
-- Storage quota columns (10GB default)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT NOT NULL DEFAULT 10737418240,
  ADD COLUMN IF NOT EXISTS storage_used_bytes  BIGINT NOT NULL DEFAULT 0;

-- Backfill current usage from existing ready video_assets
UPDATE public.tenants t
   SET storage_used_bytes = COALESCE(sub.total, 0)
  FROM (
    SELECT tenant_id, SUM(COALESCE(size_bytes,0))::BIGINT AS total
      FROM public.video_assets
     WHERE status IN ('ready','uploading')
     GROUP BY tenant_id
  ) sub
 WHERE sub.tenant_id = t.id;

-- Trigger: keep storage_used_bytes in sync with video_assets
CREATE OR REPLACE FUNCTION public.sync_tenant_storage_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.size_bytes IS NOT NULL AND NEW.status IN ('ready','uploading') THEN
      UPDATE public.tenants
         SET storage_used_bytes = GREATEST(0, storage_used_bytes + NEW.size_bytes)
       WHERE id = NEW.tenant_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Adjust for size changes or status transitions in/out of counted states
    DECLARE
      old_counted BIGINT := CASE WHEN OLD.status IN ('ready','uploading') THEN COALESCE(OLD.size_bytes,0) ELSE 0 END;
      new_counted BIGINT := CASE WHEN NEW.status IN ('ready','uploading') THEN COALESCE(NEW.size_bytes,0) ELSE 0 END;
      delta BIGINT := new_counted - old_counted;
    BEGIN
      IF delta <> 0 THEN
        UPDATE public.tenants
           SET storage_used_bytes = GREATEST(0, storage_used_bytes + delta)
         WHERE id = NEW.tenant_id;
      END IF;
    END;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.size_bytes IS NOT NULL AND OLD.status IN ('ready','uploading') THEN
      UPDATE public.tenants
         SET storage_used_bytes = GREATEST(0, storage_used_bytes - OLD.size_bytes)
       WHERE id = OLD.tenant_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tenant_storage_used ON public.video_assets;
CREATE TRIGGER trg_sync_tenant_storage_used
  AFTER INSERT OR UPDATE OR DELETE ON public.video_assets
  FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_storage_used();

-- Quota check helper (used by initVideoUpload)
CREATE OR REPLACE FUNCTION public.check_storage_quota(_tenant_id UUID, _incoming_bytes BIGINT)
RETURNS TABLE (allowed BOOLEAN, quota_bytes BIGINT, used_bytes BIGINT, remaining_bytes BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q BIGINT; u BIGINT;
BEGIN
  SELECT storage_quota_bytes, storage_used_bytes
    INTO q, u
    FROM public.tenants WHERE id = _tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;
  quota_bytes := q;
  used_bytes := u;
  remaining_bytes := GREATEST(0, q - u);
  allowed := (u + COALESCE(_incoming_bytes,0)) <= q;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.check_storage_quota(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_storage_quota(UUID, BIGINT) TO authenticated;

-- Super admin can set quota per tenant
CREATE OR REPLACE FUNCTION public.admin_set_storage_quota(_tenant_id UUID, _quota_bytes BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(_uid, 'super_admin') THEN
    RAISE EXCEPTION 'Only super admin can change tenant quota';
  END IF;
  IF _quota_bytes < 0 THEN RAISE EXCEPTION 'Quota must be non-negative'; END IF;
  UPDATE public.tenants SET storage_quota_bytes = _quota_bytes WHERE id = _tenant_id;
  RETURN _quota_bytes;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_storage_quota(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_storage_quota(UUID, BIGINT) TO authenticated;
