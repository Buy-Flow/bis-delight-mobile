ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS news_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS news_title text NOT NULL DEFAULT 'Novidades',
  ADD COLUMN IF NOT EXISTS news_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb;