DO $$ BEGIN
  CREATE TYPE public.review_status AS ENUM ('published', 'hidden', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  comment TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  status public.review_status NOT NULL DEFAULT 'published',
  reply TEXT,
  replied_at TIMESTAMPTZ,
  replied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  helpful_count INT NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

CREATE INDEX IF NOT EXISTS reviews_product_idx  ON public.reviews (product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_user_idx     ON public.reviews (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_order_idx    ON public.reviews (order_id);
CREATE INDEX IF NOT EXISTS reviews_status_idx   ON public.reviews (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_order_unique
  ON public.reviews (user_id, order_id) WHERE order_id IS NOT NULL;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads published reviews"
  ON public.reviews FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "user reads own reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user inserts own review"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      order_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_id
          AND o.user_id = auth.uid()
          AND o.status IN ('entregue', 'pago')
      )
    )
  );

CREATE POLICY "user updates own review"
  ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user deletes own review"
  ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin manages all reviews"
  ON public.reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.reviews_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reviews_touch_updated_at() FROM anon;

DROP TRIGGER IF EXISTS reviews_touch_updated_at ON public.reviews;
CREATE TRIGGER reviews_touch_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_touch_updated_at();

CREATE OR REPLACE FUNCTION public.reviews_stamp_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reply IS DISTINCT FROM OLD.reply THEN
    IF NEW.reply IS NULL OR btrim(NEW.reply) = '' THEN
      NEW.reply := NULL;
      NEW.replied_at := NULL;
      NEW.replied_by := NULL;
    ELSE
      NEW.replied_at := now();
      NEW.replied_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reviews_stamp_reply() FROM anon;

DROP TRIGGER IF EXISTS reviews_stamp_reply ON public.reviews;
CREATE TRIGGER reviews_stamp_reply
  BEFORE UPDATE OF reply ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_stamp_reply();