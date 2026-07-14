
-- 1) Revoke anon EXECUTE on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.complete_delivery(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_review_helpful_count() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reward_referrer_on_paid() FROM anon;

-- 2) Tighten delivery_offers UPDATE policy: courier can only update their own row
DROP POLICY IF EXISTS "Courier responds to offers" ON public.delivery_offers;
CREATE POLICY "Courier responds to offers"
ON public.delivery_offers
FOR UPDATE
TO authenticated
USING (
  status = 'pending'
  AND (
    courier_id = current_courier_id()
    OR (broadcast = true AND current_courier_id() IS NOT NULL)
  )
)
WITH CHECK (
  courier_id = current_courier_id()
);

-- 3) Tighten storage.objects INSERT for delivery-proofs: only for the courier's own orders.
-- Object path convention: '<order_id>/...' — enforced via (storage.foldername(name))[1].
DROP POLICY IF EXISTS "couriers upload delivery proofs" ON storage.objects;
CREATE POLICY "couriers upload delivery proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND current_courier_id() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.courier_id = current_courier_id()
  )
);

-- 4) Prevent order price tampering: enforce unit_price >= product base_price
CREATE OR REPLACE FUNCTION public.validate_order_item_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_base_price NUMERIC;
  p_active BOOLEAN;
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity < 1 OR NEW.quantity > 100 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;
  IF NEW.unit_price IS NULL OR NEW.unit_price < 0 THEN
    RAISE EXCEPTION 'invalid_price';
  END IF;

  SELECT base_price, active INTO p_base_price, p_active
  FROM public.products WHERE id = NEW.product_id;

  IF p_base_price IS NULL THEN
    -- unknown product (e.g. combo/custom line); allow but require price >= 0 (checked above)
    RETURN NEW;
  END IF;

  IF p_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'product_not_active';
  END IF;

  -- unit_price cannot be lower than the product's minimum (base_price is the
  -- smallest possible size on all current products). Extras/sizes can only add.
  -- Allow 1 cent tolerance for rounding.
  IF NEW.unit_price + 0.01 < p_base_price THEN
    RAISE EXCEPTION 'price_below_base' USING DETAIL = format('product=%s unit=%s base=%s', NEW.product_id, NEW.unit_price, p_base_price);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_item_price_trg ON public.order_items;
CREATE TRIGGER validate_order_item_price_trg
BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.validate_order_item_price();

-- Sanity: subtotal / delivery_fee / total must be non-negative
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_amounts_nonneg;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_amounts_nonneg
  CHECK (
    (subtotal IS NULL OR subtotal >= 0)
    AND (delivery_fee IS NULL OR delivery_fee >= 0)
    AND (total IS NULL OR total >= 0)
  );
