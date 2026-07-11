CREATE OR REPLACE FUNCTION public.get_loyalty_status()
 RETURNS TABLE(tier text, lifetime_stamps integer, current_stamps integer, stamps_to_next integer, next_tier text, reward_value numeric, stamps_per_order integer, active_coupons integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _stamps int := 0; _life int := 0; _tier text; _next text; _next_min int; _to_next int; _cps int := 0;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT l.stamps, l.lifetime_stamps INTO _stamps, _life FROM public.loyalty l WHERE l.user_id = _uid;
  IF _stamps IS NULL THEN _stamps := 0; END IF;
  IF _life IS NULL THEN _life := 0; END IF;
  _tier := public.loyalty_tier(_life);

  SELECT t.tier, t.min_lifetime INTO _next, _next_min
  FROM public.loyalty_tiers t
  WHERE t.min_lifetime > _life
  ORDER BY t.min_lifetime ASC
  LIMIT 1;
  IF _next IS NULL THEN _to_next := 0; ELSE _to_next := GREATEST(_next_min - _life, 0); END IF;

  SELECT count(*) INTO _cps FROM public.loyalty_coupons WHERE user_id = _uid AND used_at IS NULL;
  RETURN QUERY SELECT _tier, _life, _stamps, _to_next, _next,
    public.loyalty_reward_value(_tier), 1 + public.loyalty_stamp_bonus(_tier), _cps;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.get_loyalty_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_loyalty_status() TO authenticated;