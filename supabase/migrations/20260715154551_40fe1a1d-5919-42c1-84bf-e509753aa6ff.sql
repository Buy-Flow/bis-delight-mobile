
CREATE TABLE IF NOT EXISTS public.product_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT 'oklch(0.85 0.19 90)',
  icon text NOT NULL DEFAULT '🏷️',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_badges TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_badges TO authenticated;
GRANT ALL ON public.product_badges TO service_role;

ALTER TABLE public.product_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_badges public select"
  ON public.product_badges FOR SELECT
  USING (true);

CREATE POLICY "product_badges admin insert"
  ON public.product_badges FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "product_badges admin update"
  ON public.product_badges FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "product_badges admin delete"
  ON public.product_badges FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_product_badges_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS product_badges_updated_at ON public.product_badges;
CREATE TRIGGER product_badges_updated_at
BEFORE UPDATE ON public.product_badges
FOR EACH ROW EXECUTE FUNCTION public.tg_product_badges_updated_at();

INSERT INTO public.product_badges (name, color, icon, sort_order) VALUES
  ('Premium', 'oklch(0.87 0.19 95)', '⭐', 1),
  ('Novidade', 'oklch(0.80 0.16 200)', '✨', 2),
  ('Favorito', 'oklch(0.72 0.22 350)', '❤️', 3)
ON CONFLICT (name) DO NOTHING;
