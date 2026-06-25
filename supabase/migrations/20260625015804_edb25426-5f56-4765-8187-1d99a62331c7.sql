ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS hero_title TEXT,
  ADD COLUMN IF NOT EXISTS hero_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_theme_check') THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_theme_check
      CHECK (theme IN ('classic', 'modern', 'bold', 'minimal'));
  END IF;
END $$;