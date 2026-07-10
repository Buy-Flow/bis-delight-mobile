
ALTER TABLE public.loyalty ADD COLUMN IF NOT EXISTS lifetime_stamps int NOT NULL DEFAULT 0;
ALTER TABLE public.loyalty_coupons ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 20;

UPDATE public.loyalty
   SET lifetime_stamps = GREATEST(lifetime_stamps, stamps + (total_redeemed * 10));

CREATE OR REPLACE FUNCTION public.loyalty_tier(_lifetime int)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _lifetime >= 30 THEN 'ouro' WHEN _lifetime >= 10 THEN 'prata' ELSE 'bronze' END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_reward_value(_tier text)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _tier WHEN 'ouro' THEN 30::numeric WHEN 'prata' THEN 25::numeric ELSE 20::numeric END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_stamp_bonus(_tier text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _tier WHEN 'ouro' THEN 2 WHEN 'prata' THEN 1 ELSE 0 END;
$$;

REVOKE EXECUTE ON FUNCTION public.loyalty_tier(int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.loyalty_reward_value(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.loyalty_stamp_bonus(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_tier(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_reward_value(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_stamp_bonus(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_loyalty_status()
RETURNS TABLE(
  tier text, lifetime_stamps int, current_stamps int, stamps_to_next int,
  next_tier text, reward_value numeric, stamps_per_order int, active_coupons int
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _stamps int := 0; _life int := 0; _tier text; _next text; _to_next int; _cps int := 0;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT l.stamps, l.lifetime_stamps INTO _stamps, _life FROM public.loyalty l WHERE l.user_id = _uid;
  IF _stamps IS NULL THEN _stamps := 0; END IF;
  IF _life IS NULL THEN _life := 0; END IF;
  _tier := public.loyalty_tier(_life);
  IF _tier = 'bronze' THEN _next := 'prata'; _to_next := 10 - _life;
  ELSIF _tier = 'prata' THEN _next := 'ouro'; _to_next := 30 - _life;
  ELSE _next := NULL; _to_next := 0; END IF;
  SELECT count(*) INTO _cps FROM public.loyalty_coupons WHERE user_id = _uid AND used_at IS NULL;
  RETURN QUERY SELECT _tier, _life, _stamps, GREATEST(_to_next, 0), _next,
    public.loyalty_reward_value(_tier), 1 + public.loyalty_stamp_bonus(_tier), _cps;
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_loyalty_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_loyalty_status() TO authenticated;

DROP FUNCTION IF EXISTS public.validate_loyalty_coupon(text);
CREATE FUNCTION public.validate_loyalty_coupon(_code text)
RETURNS TABLE(id uuid, code text, discount_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  RETURN QUERY SELECT c.id, c.code, c.discount_value
    FROM public.loyalty_coupons c
    WHERE c.code = upper(btrim(_code)) AND c.user_id = _uid AND c.used_at IS NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.validate_loyalty_coupon(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_loyalty_coupon(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.grant_loyalty_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  current_stamps int; current_lifetime int;
  base_inc int := 1; tier_bonus int := 0; bday_bonus int := 0;
  this_month text := to_char(now(), 'YYYY-MM');
  bday date; last_bonus text; new_code text;
  _tier text; _reward numeric; total_inc int;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pago' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pago' THEN RETURN NEW; END IF;
  IF NEW.total < 20 THEN RETURN NEW; END IF;

  INSERT INTO public.loyalty (user_id) VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;

  SELECT lifetime_stamps INTO current_lifetime FROM public.loyalty WHERE user_id = NEW.user_id;
  IF current_lifetime IS NULL THEN current_lifetime := 0; END IF;
  _tier := public.loyalty_tier(current_lifetime);
  tier_bonus := public.loyalty_stamp_bonus(_tier);

  SELECT birthday INTO bday FROM public.profiles WHERE id = NEW.user_id;
  SELECT last_birthday_bonus INTO last_bonus FROM public.loyalty WHERE user_id = NEW.user_id;
  IF bday IS NOT NULL AND to_char(bday, 'MM') = to_char(now(), 'MM')
     AND (last_bonus IS NULL OR last_bonus <> this_month) THEN
    bday_bonus := 1;
    UPDATE public.loyalty SET last_birthday_bonus = this_month WHERE user_id = NEW.user_id;
  END IF;

  total_inc := base_inc + tier_bonus + bday_bonus;
  UPDATE public.loyalty
     SET stamps = stamps + total_inc, lifetime_stamps = lifetime_stamps + total_inc
   WHERE user_id = NEW.user_id RETURNING stamps INTO current_stamps;

  WHILE current_stamps >= 10 LOOP
    SELECT lifetime_stamps INTO current_lifetime FROM public.loyalty WHERE user_id = NEW.user_id;
    _tier := public.loyalty_tier(current_lifetime);
    _reward := public.loyalty_reward_value(_tier);
    new_code := 'BIS-' || upper(substring(replace(gen_random_uuid()::text,'-',''), 1, 8));
    INSERT INTO public.loyalty_coupons (user_id, code, discount_value)
      VALUES (NEW.user_id, new_code, _reward);
    UPDATE public.loyalty SET stamps = stamps - 10, total_redeemed = total_redeemed + 1
      WHERE user_id = NEW.user_id RETURNING stamps INTO current_stamps;
  END LOOP;
  RETURN NEW;
END; $function$;
