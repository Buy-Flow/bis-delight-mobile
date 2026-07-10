
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS popup_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS popup_body text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS popup_image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS popup_link text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS popup_cta text NOT NULL DEFAULT 'Ver agora',
  ADD COLUMN IF NOT EXISTS popup_image_pos_x numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS popup_image_pos_y numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS popup_image_scale numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS popup_frequency text NOT NULL DEFAULT 'session';
