
CREATE TABLE public.promo_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('fixed','percent')),
  discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
  min_order numeric(10,2) NOT NULL DEFAULT 0,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  per_user_limit integer NOT NULL DEFAULT 1,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.promo_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.promo_coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.promo_coupon_redemptions (coupon_id);
CREATE INDEX ON public.promo_coupon_redemptions (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_coupons TO authenticated;
GRANT ALL ON public.promo_coupons TO service_role;
GRANT SELECT, INSERT ON public.promo_coupon_redemptions TO authenticated;
GRANT ALL ON public.promo_coupon_redemptions TO service_role;

ALTER TABLE public.promo_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Admins manage promo_coupons
CREATE POLICY "Admins manage promo_coupons"
  ON public.promo_coupons FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users read (only for validation via RPC we still need select for the RPC's SECURITY DEFINER path; we restrict direct reads)
-- No SELECT policy for regular users; validation goes through SECURITY DEFINER RPC.

-- Redemptions: users see their own, admins see all
CREATE POLICY "Users see own redemptions"
  ON public.promo_coupon_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage redemptions"
  ON public.promo_coupon_redemptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER promo_coupons_updated_at
BEFORE UPDATE ON public.promo_coupons
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Validation RPC: checks code, active, expiry, uses, per-user limit, min_order
CREATE OR REPLACE FUNCTION public.validate_promo_coupon(_code text, _order_total numeric)
 RETURNS TABLE(id uuid, code text, discount_type text, discount_value numeric, discount numeric)
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'coupon_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT _c.active THEN
    RAISE EXCEPTION 'coupon_inactive' USING ERRCODE = 'P0001';
  END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN
    RAISE EXCEPTION 'coupon_expired' USING ERRCODE = 'P0001';
  END IF;
  IF _c.max_uses IS NOT NULL AND _c.uses >= _c.max_uses THEN
    RAISE EXCEPTION 'coupon_exhausted' USING ERRCODE = 'P0001';
  END IF;
  IF _order_total < _c.min_order THEN
    RAISE EXCEPTION 'order_below_minimum' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO _user_uses
    FROM public.promo_coupon_redemptions
   WHERE coupon_id = _c.id AND user_id = _uid;
  IF _c.per_user_limit IS NOT NULL AND _user_uses >= _c.per_user_limit THEN
    RAISE EXCEPTION 'coupon_user_limit' USING ERRCODE = 'P0001';
  END IF;

  IF _c.discount_type = 'fixed' THEN
    _disc := least(_c.discount_value, _order_total);
  ELSE
    _disc := round((_order_total * _c.discount_value / 100.0)::numeric, 2);
  END IF;

  RETURN QUERY SELECT _c.id, _c.code, _c.discount_type, _c.discount_value, _disc;
END;
$function$;

-- Redeem RPC: atomic increment + insert redemption
CREATE OR REPLACE FUNCTION public.redeem_promo_coupon(_code text, _order_total numeric, _order_id uuid DEFAULT NULL)
 RETURNS TABLE(id uuid, code text, discount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
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
   WHERE promo_coupons.code = upper(btrim(_code))
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'coupon_not_found' USING ERRCODE = 'P0001'; END IF;
  IF NOT _c.active THEN RAISE EXCEPTION 'coupon_inactive' USING ERRCODE = 'P0001'; END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN
    RAISE EXCEPTION 'coupon_expired' USING ERRCODE = 'P0001';
  END IF;
  IF _c.max_uses IS NOT NULL AND _c.uses >= _c.max_uses THEN
    RAISE EXCEPTION 'coupon_exhausted' USING ERRCODE = 'P0001';
  END IF;
  IF _order_total < _c.min_order THEN
    RAISE EXCEPTION 'order_below_minimum' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO _user_uses
    FROM public.promo_coupon_redemptions
   WHERE coupon_id = _c.id AND user_id = _uid;
  IF _c.per_user_limit IS NOT NULL AND _user_uses >= _c.per_user_limit THEN
    RAISE EXCEPTION 'coupon_user_limit' USING ERRCODE = 'P0001';
  END IF;

  IF _c.discount_type = 'fixed' THEN
    _disc := least(_c.discount_value, _order_total);
  ELSE
    _disc := round((_order_total * _c.discount_value / 100.0)::numeric, 2);
  END IF;

  INSERT INTO public.promo_coupon_redemptions (coupon_id, user_id, order_id)
    VALUES (_c.id, _uid, _order_id);

  UPDATE public.promo_coupons SET uses = uses + 1 WHERE promo_coupons.id = _c.id;

  RETURN QUERY SELECT _c.id, _c.code, _disc;
END;
$function$;
