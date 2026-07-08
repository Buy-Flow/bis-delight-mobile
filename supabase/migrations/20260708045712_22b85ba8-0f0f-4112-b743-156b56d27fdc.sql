ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS bg_color text NOT NULL DEFAULT '#0d0322',
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#ffe600',
  ADD COLUMN IF NOT EXISTS texture_opacity numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS texture_size text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS card_radius integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS card_border boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS card_glow boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS title_font text NOT NULL DEFAULT 'Barlow Condensed';