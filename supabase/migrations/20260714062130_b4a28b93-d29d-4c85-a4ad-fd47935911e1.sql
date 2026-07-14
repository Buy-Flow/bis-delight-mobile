
-- 1) Coupon discount column so recompute preserves discount semantics
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_discount numeric NOT NULL DEFAULT 0;

-- 2) Server-side pricing validator: rebuilds the MINIMUM acceptable unit_price
--    from products.base_price + sizes[].priceDelta + sum(extras[].price >= 0).
--    Rejects the row if the client-sent unit_price is below the server floor.
CREATE OR REPLACE FUNCTION public.enforce_order_item_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base numeric;
  v_sizes jsonb;
  v_size_delta numeric := 0;
  v_extras_sum numeric := 0;
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

  -- Custom builder / combo / promo items may not have a product_id in catalog: skip strict floor
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT base_price, sizes
    INTO v_base, v_sizes
  FROM public.products
  WHERE id = NEW.product_id;

  -- Not in catalog (custom item, combo, etc.) — skip
  IF v_base IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve size priceDelta if a size was picked
  IF NEW.size IS NOT NULL AND v_sizes IS NOT NULL AND jsonb_typeof(v_sizes) = 'array' THEN
    SELECT COALESCE((elem->>'priceDelta')::numeric, 0)
      INTO v_size_delta
    FROM jsonb_array_elements(v_sizes) AS elem
    WHERE elem->>'id' = NEW.size
    LIMIT 1;
    v_size_delta := COALESCE(v_size_delta, 0);
  END IF;

  -- Sum extras[].price (only non-negative to prevent negative-priced extras injection)
  IF NEW.extras IS NOT NULL AND jsonb_typeof(NEW.extras) = 'array' THEN
    FOR v_extra IN SELECT * FROM jsonb_array_elements(NEW.extras)
    LOOP
      v_extra_price := COALESCE((v_extra->>'price')::numeric, 0);
      IF v_extra_price > 0 THEN
        v_extras_sum := v_extras_sum + v_extra_price;
      END IF;
    END LOOP;
  END IF;

  v_floor   := (v_base + v_size_delta + v_extras_sum);
  v_ceiling := v_floor * 5 + 50; -- sanity cap to catch obvious tampering upward too

  -- Allow tiny rounding tolerance (1 centavo)
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

DROP TRIGGER IF EXISTS trg_enforce_order_item_pricing ON public.order_items;
CREATE TRIGGER trg_enforce_order_item_pricing
BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_pricing();

-- 3) Recompute orders.subtotal & total from actual order_items (server-authoritative)
CREATE OR REPLACE FUNCTION public.recompute_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_subtotal numeric;
  v_delivery numeric;
  v_service numeric;
  v_discount numeric;
  v_total numeric;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  IF v_order_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(unit_price * quantity), 0)
    INTO v_subtotal
  FROM public.order_items
  WHERE order_id = v_order_id;

  SELECT COALESCE(delivery_fee, 0), COALESCE(service_fee, 0), COALESCE(coupon_discount, 0)
    INTO v_delivery, v_service, v_discount
  FROM public.orders
  WHERE id = v_order_id;

  -- Discount can't exceed subtotal (prevents negative totals)
  IF v_discount > v_subtotal THEN
    v_discount := v_subtotal;
  END IF;

  v_total := GREATEST(0, v_subtotal + COALESCE(v_delivery,0) + COALESCE(v_service,0) - v_discount);

  UPDATE public.orders
     SET subtotal = v_subtotal,
         coupon_discount = v_discount,
         total = v_total
   WHERE id = v_order_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_order_totals ON public.order_items;
CREATE TRIGGER trg_recompute_order_totals
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.recompute_order_totals();

-- 4) Block ordinary users from mutating financial columns on orders after creation.
--    Staff (admin/manager/cashier/waiter) and service_role remain unrestricted.
CREATE OR REPLACE FUNCTION public.guard_order_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean := false;
BEGIN
  -- service_role bypasses
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    -- No JWT: this is coming from a definer trigger (recompute). Allow.
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','manager','cashier','waiter')
  ) INTO v_is_staff;

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  -- Regular customer: financial columns are immutable from client
  IF NEW.subtotal        IS DISTINCT FROM OLD.subtotal        THEN NEW.subtotal        := OLD.subtotal;        END IF;
  IF NEW.total           IS DISTINCT FROM OLD.total           THEN NEW.total           := OLD.total;           END IF;
  IF NEW.delivery_fee    IS DISTINCT FROM OLD.delivery_fee    THEN NEW.delivery_fee    := OLD.delivery_fee;    END IF;
  IF NEW.service_fee     IS DISTINCT FROM OLD.service_fee     THEN NEW.service_fee     := OLD.service_fee;     END IF;
  IF NEW.coupon_discount IS DISTINCT FROM OLD.coupon_discount THEN NEW.coupon_discount := OLD.coupon_discount; END IF;
  IF NEW.coupon_code     IS DISTINCT FROM OLD.coupon_code     THEN NEW.coupon_code     := OLD.coupon_code;     END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_financials ON public.orders;
CREATE TRIGGER trg_guard_order_financials
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_financials();
