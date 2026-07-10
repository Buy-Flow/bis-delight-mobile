
-- ==== 1. Upsell ====
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_upsell boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upsell_price numeric(10,2);

-- ==== 5. Estoque ====
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock integer,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

-- ==== 6. Pagamento preferido ====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_payment text;

-- ==== 3. Urgência ====
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS urgency_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgency_text text DEFAULT 'Sexta Especial acaba em',
  ADD COLUMN IF NOT EXISTS urgency_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS urgency_coupon_code text;

-- ==== 2. Combos ====
CREATE TABLE IF NOT EXISTS public.combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  discount_percent numeric(5,2) NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.combos TO anon, authenticated;
GRANT ALL ON public.combos TO service_role;

ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "combos public read active" ON public.combos
  FOR SELECT USING (active = true);

CREATE POLICY "admins manage combos" ON public.combos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER combos_updated_at BEFORE UPDATE ON public.combos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==== Trigger de decremento de estoque ====
CREATE OR REPLACE FUNCTION public.decrement_stock_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pago' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pago') THEN
    UPDATE public.products p
       SET stock = GREATEST(0, p.stock - oi.qty)
      FROM (
        SELECT product_id, SUM(quantity)::int AS qty
          FROM public.order_items
         WHERE order_id = NEW.id
         GROUP BY product_id
      ) oi
     WHERE p.id = oi.product_id AND p.stock IS NOT NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS decrement_stock_on_paid_trg ON public.orders;
CREATE TRIGGER decrement_stock_on_paid_trg
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_paid();
