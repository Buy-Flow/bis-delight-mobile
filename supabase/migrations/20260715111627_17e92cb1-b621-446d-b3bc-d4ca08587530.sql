CREATE OR REPLACE FUNCTION public.validate_order_item_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_base_price NUMERIC;
  p_active BOOLEAN;
  p_is_upsell BOOLEAN;
  p_upsell_price NUMERIC;
  p_floor NUMERIC;
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity < 1 OR NEW.quantity > 100 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;
  IF NEW.unit_price IS NULL OR NEW.unit_price < 0 THEN
    RAISE EXCEPTION 'invalid_price';
  END IF;

  SELECT base_price, active, COALESCE(is_upsell, false), upsell_price
    INTO p_base_price, p_active, p_is_upsell, p_upsell_price
  FROM public.products WHERE id = NEW.product_id;

  IF p_base_price IS NULL THEN
    RETURN NEW;
  END IF;

  IF p_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'product_not_active';
  END IF;

  IF p_is_upsell AND p_upsell_price IS NOT NULL AND p_upsell_price >= 0 THEN
    p_floor := LEAST(p_base_price, p_upsell_price);
  ELSE
    p_floor := p_base_price;
  END IF;

  IF NEW.unit_price + 0.01 < p_floor THEN
    RAISE EXCEPTION 'price_below_base' USING DETAIL = format('product=%s unit=%s base=%s', NEW.product_id, NEW.unit_price, p_floor);
  END IF;

  RETURN NEW;
END;
$$;