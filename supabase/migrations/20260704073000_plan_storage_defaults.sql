-- Trigger to automatically set storage_quota_bytes when tenant plan changes
CREATE OR REPLACE FUNCTION public.set_tenant_storage_quota_by_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If storage quota is not explicitly set or plan changed, adjust default quota based on plan
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.plan IS DISTINCT FROM NEW.plan)) THEN
    IF NEW.plan = 'starter' THEN
      NEW.storage_quota_bytes := GREATEST(COALESCE(NEW.storage_quota_bytes, 0), 53687091200); -- 50 GB
    ELSIF NEW.plan = 'pro' THEN
      NEW.storage_quota_bytes := GREATEST(COALESCE(NEW.storage_quota_bytes, 0), 214748364800); -- 200 GB
    ELSIF NEW.plan = 'enterprise' THEN
      NEW.storage_quota_bytes := GREATEST(COALESCE(NEW.storage_quota_bytes, 0), 1073741824000); -- 1 TB
    ELSE
      -- Default free plan: 10 GB
      NEW.storage_quota_bytes := GREATEST(COALESCE(NEW.storage_quota_bytes, 0), 10737418240); -- 10 GB
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_tenant_storage_quota_by_plan ON public.tenants;
CREATE TRIGGER trg_set_tenant_storage_quota_by_plan
  BEFORE INSERT OR UPDATE OF plan ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_storage_quota_by_plan();
