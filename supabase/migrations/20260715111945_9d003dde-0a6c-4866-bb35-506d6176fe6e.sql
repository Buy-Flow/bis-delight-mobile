CREATE OR REPLACE FUNCTION public.guard_order_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean := false;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN ('admin','manager','cashier','waiter','staff')
  ) INTO v_is_staff;

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.subtotal        IS DISTINCT FROM OLD.subtotal        THEN NEW.subtotal        := OLD.subtotal;        END IF;
  IF NEW.total           IS DISTINCT FROM OLD.total           THEN NEW.total           := OLD.total;           END IF;
  IF NEW.delivery_fee    IS DISTINCT FROM OLD.delivery_fee    THEN NEW.delivery_fee    := OLD.delivery_fee;    END IF;
  IF NEW.service_fee     IS DISTINCT FROM OLD.service_fee     THEN NEW.service_fee     := OLD.service_fee;     END IF;
  IF NEW.coupon_discount IS DISTINCT FROM OLD.coupon_discount THEN NEW.coupon_discount := OLD.coupon_discount; END IF;
  IF NEW.coupon_code     IS DISTINCT FROM OLD.coupon_code     THEN NEW.coupon_code     := OLD.coupon_code;     END IF;

  RETURN NEW;
END;
$$;