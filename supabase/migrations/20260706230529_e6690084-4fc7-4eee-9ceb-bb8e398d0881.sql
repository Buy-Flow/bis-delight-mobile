ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS instagram text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS facebook text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tiktok text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS announcement_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS announcement_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pix_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_methods jsonb NOT NULL DEFAULT '["Dinheiro","Pix","Cartão"]'::jsonb,
  ADD COLUMN IF NOT EXISTS free_delivery_threshold numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_order numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepts_delivery boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_pickup boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS open_override text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS hours_json jsonb NOT NULL DEFAULT '[]'::jsonb;