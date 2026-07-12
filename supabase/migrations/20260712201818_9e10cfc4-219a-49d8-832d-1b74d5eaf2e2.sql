
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS rating_food smallint CHECK (rating_food IS NULL OR (rating_food BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS rating_delivery smallint CHECK (rating_delivery IS NULL OR (rating_delivery BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS rating_packaging smallint CHECK (rating_packaging IS NULL OR (rating_packaging BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS rating_service smallint CHECK (rating_service IS NULL OR (rating_service BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS rating_value smallint CHECK (rating_value IS NULL OR (rating_value BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS would_recommend boolean,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS order_mode text;

CREATE INDEX IF NOT EXISTS reviews_order_user_idx
  ON public.reviews (user_id, order_id)
  WHERE order_id IS NOT NULL;
