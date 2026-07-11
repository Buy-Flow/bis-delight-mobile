
-- New tier thresholds
CREATE OR REPLACE FUNCTION public.loyalty_tier(_lifetime integer)
 RETURNS text LANGUAGE sql IMMUTABLE
AS $function$
  SELECT CASE WHEN _lifetime >= 100 THEN 'ouro' WHEN _lifetime >= 20 THEN 'prata' ELSE 'bronze' END;
$function$;

-- New reward values
CREATE OR REPLACE FUNCTION public.loyalty_reward_value(_tier text)
 RETURNS numeric LANGUAGE sql IMMUTABLE
AS $function$
  SELECT CASE _tier WHEN 'ouro' THEN 20::numeric WHEN 'prata' THEN 15::numeric ELSE 10::numeric END;
$function$;

-- Min order by tier
CREATE OR REPLACE FUNCTION public.loyalty_min_order(_tier text)
 RETURNS numeric LANGUAGE sql IMMUTABLE
AS $function$
  SELECT CASE _tier WHEN 'bronze' THEN 20::numeric ELSE 10::numeric END;
$function$;

-- Update loyalty status thresholds
CREATE OR REPLACE FUNCTION public.get_loyalty_status()
 RETURNS TABLE(tier text, lifetime_stamps integer, current_stamps integer, stamps_to_next integer, next_tier text, reward_value numeric, stamps_per_order integer, active_coupons integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _stamps int := 0; _life int := 0; _tier text; _next text; _to_next int; _cps int := 0;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT l.stamps, l.lifetime_stamps INTO _stamps, _life FROM public.loyalty l WHERE l.user_id = _uid;
  IF _stamps IS NULL THEN _stamps := 0; END IF;
  IF _life IS NULL THEN _life := 0; END IF;
  _tier := public.loyalty_tier(_life);
  IF _tier = 'bronze' THEN _next := 'prata'; _to_next := 20 - _life;
  ELSIF _tier = 'prata' THEN _next := 'ouro'; _to_next := 100 - _life;
  ELSE _next := NULL; _to_next := 0; END IF;
  SELECT count(*) INTO _cps FROM public.loyalty_coupons WHERE user_id = _uid AND used_at IS NULL;
  RETURN QUERY SELECT _tier, _life, _stamps, GREATEST(_to_next, 0), _next,
    public.loyalty_reward_value(_tier), 1 + public.loyalty_stamp_bonus(_tier), _cps;
END; $function$;

-- Tier-based minimum order in stamp grant
CREATE OR REPLACE FUNCTION public.grant_loyalty_stamp()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  current_stamps int; current_lifetime int;
  base_inc int := 1; tier_bonus int := 0; bday_bonus int := 0;
  this_month text := to_char(now(), 'YYYY-MM');
  bday date; last_bonus text; new_code text;
  _tier text; _reward numeric; _min_order numeric; total_inc int;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pago' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pago' THEN RETURN NEW; END IF;

  INSERT INTO public.loyalty (user_id) VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;

  SELECT lifetime_stamps INTO current_lifetime FROM public.loyalty WHERE user_id = NEW.user_id;
  IF current_lifetime IS NULL THEN current_lifetime := 0; END IF;
  _tier := public.loyalty_tier(current_lifetime);
  _min_order := public.loyalty_min_order(_tier);

  IF NEW.total < _min_order THEN RETURN NEW; END IF;

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
