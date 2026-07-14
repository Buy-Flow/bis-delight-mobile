
DROP FUNCTION IF EXISTS public.validate_promo_coupon(text, numeric);

CREATE OR REPLACE FUNCTION public.validate_promo_coupon(_code text, _order_total numeric)
 RETURNS TABLE(id uuid, code text, discount_type text, discount_value numeric, discount numeric, min_order numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _c public.promo_coupons%ROWTYPE;
  _user_uses int;
  _disc numeric;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO _c FROM public.promo_coupons
   WHERE promo_coupons.code = upper(btrim(_code));

  IF NOT FOUND THEN RAISE EXCEPTION 'coupon_not_found' USING ERRCODE = 'P0001'; END IF;
  IF NOT _c.active THEN RAISE EXCEPTION 'coupon_inactive' USING ERRCODE = 'P0001'; END IF;
  IF _c.starts_at IS NOT NULL AND _c.starts_at > now() THEN RAISE EXCEPTION 'coupon_not_started' USING ERRCODE = 'P0001'; END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN RAISE EXCEPTION 'coupon_expired' USING ERRCODE = 'P0001'; END IF;
  IF _c.max_uses IS NOT NULL AND _c.uses >= _c.max_uses THEN RAISE EXCEPTION 'coupon_exhausted' USING ERRCODE = 'P0001'; END IF;
  IF _order_total < _c.min_order THEN RAISE EXCEPTION 'order_below_minimum' USING ERRCODE = 'P0001'; END IF;

  SELECT count(*) INTO _user_uses FROM public.promo_coupon_redemptions
   WHERE coupon_id = _c.id AND user_id = _uid;
  IF _c.per_user_limit IS NOT NULL AND _user_uses >= _c.per_user_limit THEN
    RAISE EXCEPTION 'coupon_user_limit' USING ERRCODE = 'P0001';
  END IF;

  IF _c.discount_type = 'fixed' THEN
    _disc := least(_c.discount_value, _order_total);
  ELSE
    _disc := round((_order_total * _c.discount_value / 100.0)::numeric, 2);
  END IF;

  RETURN QUERY SELECT _c.id, _c.code, _c.discount_type, _c.discount_value, _disc, COALESCE(_c.min_order, 0)::numeric;
END;
$function$;
