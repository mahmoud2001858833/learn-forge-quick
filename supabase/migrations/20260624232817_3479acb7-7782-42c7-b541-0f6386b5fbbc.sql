-- video_assets: tracks uploads to Cloudflare R2 via Worker
CREATE TYPE public.video_status AS ENUM ('pending', 'uploading', 'processing', 'ready', 'failed');

CREATE TABLE public.video_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  r2_key TEXT NOT NULL,
  upload_id TEXT,
  status public.video_status NOT NULL DEFAULT 'pending',
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  duration_seconds INT,
  width INT,
  height INT,
  thumbnail_key TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, r2_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_assets TO authenticated;
GRANT ALL ON public.video_assets TO service_role;

ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their video assets"
  ON public.video_assets FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admins can insert video assets"
  ON public.video_assets FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Tenant admins can update video assets"
  ON public.video_assets FOR UPDATE TO authenticated
  USING (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Tenant owners can delete video assets"
  ON public.video_assets FOR DELETE TO authenticated
  USING (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER update_video_assets_updated_at
  BEFORE UPDATE ON public.video_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_video_assets_tenant ON public.video_assets(tenant_id);
CREATE INDEX idx_video_assets_status ON public.video_assets(status);

-- Link lessons to video assets
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS video_asset_id UUID REFERENCES public.video_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_video_asset ON public.lessons(video_asset_id);

-- Per-tenant playback secret for signed URLs (HMAC)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS playback_token_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  ADD COLUMN IF NOT EXISTS r2_public_worker_url TEXT;
