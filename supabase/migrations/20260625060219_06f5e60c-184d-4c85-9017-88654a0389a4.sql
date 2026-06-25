ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS payment_cash_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_bank_transfer_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS coupons_enabled boolean NOT NULL DEFAULT true;