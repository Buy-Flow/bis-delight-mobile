
CREATE TABLE IF NOT EXISTS public.review_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled BOOLEAN NOT NULL DEFAULT true,
  show_on_product_page BOOLEAN NOT NULL DEFAULT true,
  require_purchase BOOLEAN NOT NULL DEFAULT true,
  auto_approve_min_rating SMALLINT NOT NULL DEFAULT 4,
  auto_hide_below_rating SMALLINT NOT NULL DEFAULT 0,
  photo_required_for_reward BOOLEAN NOT NULL DEFAULT false,
  reward_coupon_code TEXT,
  reward_message TEXT DEFAULT 'Ganhe 10% de desconto no próximo pedido enviando sua avaliação com foto! 📸',
  incentive_enabled BOOLEAN NOT NULL DEFAULT true,
  min_photos_for_featured SMALLINT NOT NULL DEFAULT 1,
  gallery_style TEXT NOT NULL DEFAULT 'grid' CHECK (gallery_style IN ('grid','carousel','masonry')),
  default_sort TEXT NOT NULL DEFAULT 'helpful' CHECK (default_sort IN ('helpful','recent','rating_high','rating_low','photos_first')),
  show_reviewer_name BOOLEAN NOT NULL DEFAULT true,
  mask_reviewer_name BOOLEAN NOT NULL DEFAULT false,
  show_verified_badge BOOLEAN NOT NULL DEFAULT true,
  show_reply BOOLEAN NOT NULL DEFAULT true,
  min_reviews_to_display SMALLINT NOT NULL DEFAULT 0,
  photos_per_review_limit SMALLINT NOT NULL DEFAULT 5,
  cta_title TEXT DEFAULT 'O que dizem nossos clientes',
  cta_subtitle TEXT DEFAULT 'Avaliações reais de quem já pediu',
  empty_state_text TEXT DEFAULT 'Seja o primeiro a avaliar este produto!',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.review_settings TO anon, authenticated;
GRANT ALL ON public.review_settings TO service_role;
GRANT UPDATE, INSERT ON public.review_settings TO authenticated;

ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_settings public read" ON public.review_settings FOR SELECT USING (true);
CREATE POLICY "review_settings admin write" ON public.review_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

INSERT INTO public.review_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Helpful votes table (prevent duplicate votes)
CREATE TABLE IF NOT EXISTS public.review_helpful_votes (
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.review_helpful_votes TO authenticated;
GRANT ALL ON public.review_helpful_votes TO service_role;
ALTER TABLE public.review_helpful_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_votes select own" ON public.review_helpful_votes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "review_votes insert own" ON public.review_helpful_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "review_votes delete own" ON public.review_helpful_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Sync helpful_count via trigger
CREATE OR REPLACE FUNCTION public.sync_review_helpful_count() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reviews SET helpful_count = COALESCE(helpful_count,0) + 1 WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reviews SET helpful_count = GREATEST(COALESCE(helpful_count,0) - 1, 0) WHERE id = OLD.review_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_review_helpful ON public.review_helpful_votes;
CREATE TRIGGER trg_sync_review_helpful
AFTER INSERT OR DELETE ON public.review_helpful_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_review_helpful_count();

-- Public function to fetch product reviews with reviewer name safely
CREATE OR REPLACE FUNCTION public.get_product_reviews(_product_id TEXT, _limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID, rating SMALLINT, title TEXT, comment TEXT, photos TEXT[],
  reply TEXT, replied_at TIMESTAMPTZ, helpful_count INT, featured BOOLEAN,
  created_at TIMESTAMPTZ, reviewer_name TEXT, verified BOOLEAN, tags TEXT[]
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.rating, r.title, r.comment, r.photos, r.reply, r.replied_at,
         COALESCE(r.helpful_count, 0), r.featured, r.created_at,
         COALESCE(p.full_name, 'Cliente') as reviewer_name,
         (r.order_id IS NOT NULL) as verified,
         r.tags
  FROM public.reviews r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.product_id = _product_id AND r.status = 'published'
  ORDER BY r.featured DESC, (CASE WHEN array_length(r.photos,1) > 0 THEN 0 ELSE 1 END),
           r.helpful_count DESC, r.created_at DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_reviews(TEXT, INT) TO anon, authenticated;

-- Aggregate stats for product
CREATE OR REPLACE FUNCTION public.get_product_review_stats(_product_id TEXT)
RETURNS TABLE (total INT, avg NUMERIC, with_photos INT, d1 INT, d2 INT, d3 INT, d4 INT, d5 INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INT,
         COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0),
         COUNT(*) FILTER (WHERE array_length(photos,1) > 0)::INT,
         COUNT(*) FILTER (WHERE rating = 1)::INT,
         COUNT(*) FILTER (WHERE rating = 2)::INT,
         COUNT(*) FILTER (WHERE rating = 3)::INT,
         COUNT(*) FILTER (WHERE rating = 4)::INT,
         COUNT(*) FILTER (WHERE rating = 5)::INT
  FROM public.reviews WHERE product_id = _product_id AND status = 'published';
$$;

GRANT EXECUTE ON FUNCTION public.get_product_review_stats(TEXT) TO anon, authenticated;
