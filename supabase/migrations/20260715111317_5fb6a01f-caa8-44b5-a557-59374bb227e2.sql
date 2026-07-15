CREATE OR REPLACE FUNCTION public.enforce_order_item_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base numeric;
  v_sizes jsonb;
  v_is_upsell boolean;
  v_upsell_price numeric;
  v_size_delta numeric := 0;
  v_extras_sum numeric := 0;
  v_floor_base numeric;
  v_floor numeric;
  v_ceiling numeric;
  v_extra jsonb;
  v_extra_price numeric;
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity <= 0 OR NEW.quantity > 50 THEN
    RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = '22023';
  END IF;
  IF NEW.unit_price IS NULL OR NEW.unit_price < 0 THEN
    RAISE EXCEPTION 'invalid_unit_price' USING ERRCODE = '22023';
  END IF;

  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT base_price, sizes, COALESCE(is_upsell, false), upsell_price
    INTO v_base, v_sizes, v_is_upsell, v_upsell_price
  FROM public.products
  WHERE id = NEW.product_id;

  IF v_base IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.size IS NOT NULL AND v_sizes IS NOT NULL AND jsonb_typeof(v_sizes) = 'array' THEN
    SELECT COALESCE((elem->>'priceDelta')::numeric, 0)
      INTO v_size_delta
    FROM jsonb_array_elements(v_sizes) AS elem
    WHERE elem->>'id' = NEW.size
    LIMIT 1;
    v_size_delta := COALESCE(v_size_delta, 0);
  END IF;

  IF NEW.extras IS NOT NULL AND jsonb_typeof(NEW.extras) = 'array' THEN
    FOR v_extra IN SELECT * FROM jsonb_array_elements(NEW.extras)
    LOOP
      v_extra_price := COALESCE((v_extra->>'price')::numeric, 0);
      IF v_extra_price > 0 THEN
        v_extras_sum := v_extras_sum + v_extra_price;
      END IF;
    END LOOP;
  END IF;

  -- Upsell products: floor can drop to upsell_price (promotional price)
  IF v_is_upsell AND v_upsell_price IS NOT NULL AND v_upsell_price >= 0 THEN
    v_floor_base := LEAST(v_base, v_upsell_price);
  ELSE
    v_floor_base := v_base;
  END IF;

  v_floor   := (v_floor_base + v_size_delta + v_extras_sum);
  v_ceiling := (v_base + v_size_delta + v_extras_sum) * 5 + 50;

  IF NEW.unit_price < v_floor - 0.01 THEN
    RAISE EXCEPTION 'unit_price_below_floor: product=% expected>=% got=%',
      NEW.product_id, v_floor, NEW.unit_price
      USING ERRCODE = '22023';
  END IF;

  IF NEW.unit_price > v_ceiling THEN
    RAISE EXCEPTION 'unit_price_above_ceiling: product=% max=% got=%',
      NEW.product_id, v_ceiling, NEW.unit_price
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;