
CREATE TABLE public.product_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  qty numeric NOT NULL CHECK (qty > 0),
  waste_pct numeric NOT NULL DEFAULT 0 CHECK (waste_pct >= 0 AND waste_pct <= 100),
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, ingredient_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_recipes TO authenticated;
GRANT ALL ON public.product_recipes TO service_role;

ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage recipes" ON public.product_recipes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "auth read recipes" ON public.product_recipes
  FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_recipes_updated
BEFORE UPDATE ON public.product_recipes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_recipes_product ON public.product_recipes(product_id);
CREATE INDEX idx_recipes_ingredient ON public.product_recipes(ingredient_id);

-- Consumo automático de insumos quando pedido vai a "pago"
CREATE OR REPLACE FUNCTION public.consume_ingredients_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF NEW.status = 'pago' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pago') THEN
    FOR r IN
      SELECT pr.ingredient_id,
             SUM(oi.quantity * pr.qty * (1 + pr.waste_pct/100.0)) AS total_qty
        FROM public.order_items oi
        JOIN public.product_recipes pr ON pr.product_id = oi.product_id
       WHERE oi.order_id = NEW.id
       GROUP BY pr.ingredient_id
    LOOP
      INSERT INTO public.inventory_movements
        (item_type, ingredient_id, movement_type, qty, reason, reference)
      VALUES
        ('ingredient', r.ingredient_id, 'venda', r.total_qty,
         'Pedido #' || substring(NEW.id::text, 1, 8), NEW.id::text);
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_consume_ingredients_on_paid
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.consume_ingredients_on_paid();
