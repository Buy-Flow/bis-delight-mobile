
-- Insumos (matéria-prima)
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  unit text NOT NULL DEFAULT 'un',
  stock numeric NOT NULL DEFAULT 0,
  low_stock_threshold numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric,
  supplier text,
  supplier_phone text,
  sku text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage inventory_items" ON public.inventory_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_inventory_items_updated
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Movimentações de estoque (produtos e insumos)
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('product','ingredient')),
  product_id text REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada','saida','ajuste','perda','venda')),
  qty numeric NOT NULL,
  unit_cost numeric,
  reason text,
  reference text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (item_type='product' AND product_id IS NOT NULL AND ingredient_id IS NULL) OR
    (item_type='ingredient' AND ingredient_id IS NOT NULL AND product_id IS NULL)
  )
);

CREATE INDEX idx_inv_mov_product ON public.inventory_movements(product_id, created_at DESC);
CREATE INDEX idx_inv_mov_ingredient ON public.inventory_movements(ingredient_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage inventory_movements" ON public.inventory_movements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Aplica automaticamente movimento no estoque
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta numeric;
BEGIN
  IF NEW.movement_type = 'entrada' THEN
    delta := NEW.qty;
  ELSIF NEW.movement_type IN ('saida','perda','venda') THEN
    delta := -NEW.qty;
  ELSIF NEW.movement_type = 'ajuste' THEN
    -- ajuste: qty já é o delta (positivo ou negativo)
    delta := NEW.qty;
  ELSE
    delta := 0;
  END IF;

  IF NEW.item_type = 'product' THEN
    UPDATE public.products
       SET stock = COALESCE(stock,0) + delta
     WHERE id = NEW.product_id;
  ELSE
    UPDATE public.inventory_items
       SET stock = stock + delta
     WHERE id = NEW.ingredient_id;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_apply_inventory_movement
AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();
