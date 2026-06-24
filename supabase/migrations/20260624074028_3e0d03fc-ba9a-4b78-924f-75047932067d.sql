
-- 1) Extend tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS secondary_color TEXT NOT NULL DEFAULT '#D4AF37',
  ADD COLUMN IF NOT EXISTS welcome_message TEXT,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 2) platform_settings (per tenant, single row enforced via UNIQUE)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message TEXT,
  marquee_enabled BOOLEAN NOT NULL DEFAULT false,
  marquee_text TEXT,
  marquee_color TEXT DEFAULT '#D4AF37',
  allow_signups BOOLEAN NOT NULL DEFAULT true,
  default_commission_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  custom_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read platform settings"
  ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Tenant owner or super_admin manage settings"
  ON public.platform_settings FOR ALL TO authenticated
  USING (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'super_admin')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;

DROP TRIGGER IF EXISTS platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create a settings row when a tenant is created
CREATE OR REPLACE FUNCTION public.create_default_platform_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.platform_settings (tenant_id) VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_default_platform_settings() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tenants_create_settings ON public.tenants;
CREATE TRIGGER tenants_create_settings
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.create_default_platform_settings();

-- 3) tenant_secrets (per-tenant secrets — owner / super_admin only)
CREATE TABLE IF NOT EXISTS public.tenant_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_secrets TO authenticated;
GRANT ALL ON public.tenant_secrets TO service_role;

ALTER TABLE public.tenant_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owner or super_admin access secrets"
  ON public.tenant_secrets FOR ALL TO authenticated
  USING (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP TRIGGER IF EXISTS tenant_secrets_updated_at ON public.tenant_secrets;
CREATE TRIGGER tenant_secrets_updated_at
  BEFORE UPDATE ON public.tenant_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Super admin can read all tenants (extra SELECT policy)
DROP POLICY IF EXISTS "Super admin reads all tenants" ON public.tenants;
CREATE POLICY "Super admin reads all tenants"
  ON public.tenants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin updates tenants" ON public.tenants;
CREATE POLICY "Super admin updates tenants"
  ON public.tenants FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Super admin can read profiles & user_roles (for admin panel)
DROP POLICY IF EXISTS "Super admin reads all profiles" ON public.profiles;
CREATE POLICY "Super admin reads all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin reads all user_roles" ON public.user_roles;
CREATE POLICY "Super admin reads all user_roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
