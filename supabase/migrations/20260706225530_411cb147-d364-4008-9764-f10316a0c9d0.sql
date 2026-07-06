ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS image_pos_x numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_pos_y numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_scale numeric NOT NULL DEFAULT 1;