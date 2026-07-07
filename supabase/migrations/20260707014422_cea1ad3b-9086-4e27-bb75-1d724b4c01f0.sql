ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS hero_image_pos_x numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hero_image_pos_y numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hero_image_scale numeric NOT NULL DEFAULT 1.4;