
CREATE OR REPLACE FUNCTION public.guard_courier_self_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.name IS DISTINCT FROM OLD.name
     OR NEW.fee_per_delivery IS DISTINCT FROM OLD.fee_per_delivery
     OR NEW.active IS DISTINCT FROM OLD.active
     OR NEW.total_deliveries IS DISTINCT FROM OLD.total_deliveries
     OR NEW.total_earnings IS DISTINCT FROM OLD.total_earnings
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
     OR NEW.max_concurrent IS DISTINCT FROM OLD.max_concurrent
     OR NEW.note IS DISTINCT FROM OLD.note THEN
    RAISE EXCEPTION 'Couriers cannot modify protected fields (earnings, rating, fees, etc.)';
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_guard_courier_self_update ON public.couriers;
CREATE TRIGGER trg_guard_courier_self_update BEFORE UPDATE ON public.couriers
FOR EACH ROW EXECUTE FUNCTION public.guard_courier_self_update();

CREATE OR REPLACE FUNCTION public.guard_order_courier_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_courier boolean;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  SELECT EXISTS(SELECT 1 FROM public.couriers c WHERE c.id = OLD.courier_id AND c.user_id = auth.uid()) INTO is_courier;
  IF NOT is_courier THEN RETURN NEW; END IF;
  IF NEW.total IS DISTINCT FROM OLD.total
     OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
     OR NEW.discount IS DISTINCT FROM OLD.discount
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.asaas_payment_id IS DISTINCT FROM OLD.asaas_payment_id
     OR NEW.asaas_status IS DISTINCT FROM OLD.asaas_status
     OR NEW.customer_rating IS DISTINCT FROM OLD.customer_rating
     OR NEW.courier_rating IS DISTINCT FROM OLD.courier_rating
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.courier_id IS DISTINCT FROM OLD.courier_id THEN
    RAISE EXCEPTION 'Couriers cannot modify financial, payment, rating, or assignment fields on orders';
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_guard_order_courier_update ON public.orders;
CREATE TRIGGER trg_guard_order_courier_update BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_courier_update();

REVOKE EXECUTE ON FUNCTION public.validate_order_item_price() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_review_helpful_count() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reward_referrer_on_paid() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_delivery(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_delivery(uuid, text, text, numeric, numeric, text, text, text) FROM anon, PUBLIC;
