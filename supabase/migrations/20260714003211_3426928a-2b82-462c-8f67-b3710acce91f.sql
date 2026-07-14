
-- Settings singleton
CREATE TABLE IF NOT EXISTS public.referral_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  referrer_discount_type text NOT NULL DEFAULT 'fixed' CHECK (referrer_discount_type IN ('fixed','percent')),
  referrer_discount_value numeric NOT NULL DEFAULT 10,
  referrer_min_order numeric NOT NULL DEFAULT 25,
  referee_discount_type text NOT NULL DEFAULT 'fixed' CHECK (referee_discount_type IN ('fixed','percent')),
  referee_discount_value numeric NOT NULL DEFAULT 10,
  referee_min_order numeric NOT NULL DEFAULT 25,
  expires_days int NOT NULL DEFAULT 60,
  require_first_order boolean NOT NULL DEFAULT true,
  max_referrals_per_user int,
  share_message text NOT NULL DEFAULT 'Peço muito na Quero Bis 🍨 Usa meu link e ganha desconto no seu primeiro pedido!',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.referral_settings TO anon, authenticated;
GRANT ALL ON public.referral_settings TO service_role;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_settings_read_all" ON public.referral_settings FOR SELECT USING (true);
CREATE POLICY "referral_settings_admin_write" ON public.referral_settings FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.referral_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Codes
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  uses_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_codes_owner_read" ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Events
CREATE TABLE IF NOT EXISTS public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'signed_up' CHECK (status IN ('signed_up','first_order_paid','rewarded','expired')),
  referee_coupon_id uuid REFERENCES public.promo_coupons(id) ON DELETE SET NULL,
  referrer_coupon_id uuid REFERENCES public.promo_coupons(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS referral_events_referee_unique ON public.referral_events(referee_user_id) WHERE referee_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS referral_events_referrer_idx ON public.referral_events(referrer_user_id);
GRANT SELECT ON public.referral_events TO authenticated;
GRANT ALL ON public.referral_events TO service_role;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_events_own_read" ON public.referral_events FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referee_user_id OR public.has_role(auth.uid(),'admin'));

-- Get or create my referral code
CREATE OR REPLACE FUNCTION public.get_or_create_my_referral_code()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _code text; _tries int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;
  SELECT code INTO _code FROM public.referral_codes WHERE user_id = _uid;
  IF _code IS NOT NULL THEN RETURN _code; END IF;
  LOOP
    _code := upper(substring(replace(gen_random_uuid()::text,'-',''), 1, 7));
    BEGIN
      INSERT INTO public.referral_codes(user_id, code) VALUES (_uid, _code);
      RETURN _code;
    EXCEPTION WHEN unique_violation THEN
      _tries := _tries + 1;
      IF _tries > 6 THEN RAISE; END IF;
    END;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.get_or_create_my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_referral_code() TO authenticated;

-- Apply referral code (called by referee after signup)
CREATE OR REPLACE FUNCTION public.apply_referral_code(_code text)
RETURNS TABLE(coupon_code text, discount_type text, discount_value numeric, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _s public.referral_settings%ROWTYPE;
  _referrer uuid;
  _existing uuid;
  _new_code text;
  _coupon_id uuid;
  _expires timestamptz;
  _ref_count int;
  _orders int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;
  SELECT * INTO _s FROM public.referral_settings WHERE id=1;
  IF NOT _s.enabled THEN RAISE EXCEPTION 'program_disabled' USING ERRCODE='P0001'; END IF;

  SELECT user_id INTO _referrer FROM public.referral_codes WHERE code = upper(btrim(_code));
  IF _referrer IS NULL THEN RAISE EXCEPTION 'invalid_code' USING ERRCODE='P0001'; END IF;
  IF _referrer = _uid THEN RAISE EXCEPTION 'self_referral' USING ERRCODE='P0001'; END IF;

  SELECT id INTO _existing FROM public.referral_events WHERE referee_user_id = _uid;
  IF _existing IS NOT NULL THEN RAISE EXCEPTION 'already_referred' USING ERRCODE='P0001'; END IF;

  IF _s.require_first_order THEN
    SELECT count(*) INTO _orders FROM public.orders WHERE user_id = _uid AND status = 'pago';
    IF _orders > 0 THEN RAISE EXCEPTION 'not_new_customer' USING ERRCODE='P0001'; END IF;
  END IF;

  IF _s.max_referrals_per_user IS NOT NULL THEN
    SELECT count(*) INTO _ref_count FROM public.referral_events WHERE referrer_user_id = _referrer;
    IF _ref_count >= _s.max_referrals_per_user THEN RAISE EXCEPTION 'referrer_limit_reached' USING ERRCODE='P0001'; END IF;
  END IF;

  _expires := now() + make_interval(days => _s.expires_days);
  _new_code := 'IND-' || upper(substring(replace(gen_random_uuid()::text,'-',''), 1, 6));
  INSERT INTO public.promo_coupons
    (code, discount_type, discount_value, min_order, max_uses, per_user_limit, expires_at, active, note)
  VALUES
    (_new_code, _s.referee_discount_type, _s.referee_discount_value, _s.referee_min_order, 1, 1, _expires, true, 'Cupom de indicação (indicado)')
  RETURNING id INTO _coupon_id;

  INSERT INTO public.referral_events(referrer_user_id, referee_user_id, code, status, referee_coupon_id)
    VALUES (_referrer, _uid, upper(btrim(_code)), 'signed_up', _coupon_id);

  UPDATE public.referral_codes SET uses_count = uses_count + 1 WHERE user_id = _referrer;

  RETURN QUERY SELECT _new_code, _s.referee_discount_type, _s.referee_discount_value, _expires;
END; $$;
REVOKE ALL ON FUNCTION public.apply_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(text) TO authenticated;

-- Trigger: reward referrer on referee's first paid order
CREATE OR REPLACE FUNCTION public.reward_referrer_on_paid()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _ev public.referral_events%ROWTYPE;
  _s public.referral_settings%ROWTYPE;
  _paid_count int;
  _new_code text;
  _coupon_id uuid;
  _expires timestamptz;
BEGIN
  IF NEW.status <> 'pago' OR NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status='pago' THEN RETURN NEW; END IF;

  SELECT * INTO _ev FROM public.referral_events
   WHERE referee_user_id = NEW.user_id AND status = 'signed_up'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT * INTO _s FROM public.referral_settings WHERE id=1;
  IF NOT _s.enabled THEN RETURN NEW; END IF;

  IF _s.require_first_order THEN
    SELECT count(*) INTO _paid_count FROM public.orders WHERE user_id = NEW.user_id AND status='pago' AND id <> NEW.id;
    IF _paid_count > 0 THEN RETURN NEW; END IF;
  END IF;

  IF NEW.total < _s.referrer_min_order THEN RETURN NEW; END IF;

  _expires := now() + make_interval(days => _s.expires_days);
  _new_code := 'IND-' || upper(substring(replace(gen_random_uuid()::text,'-',''), 1, 6));
  INSERT INTO public.promo_coupons
    (code, discount_type, discount_value, min_order, max_uses, per_user_limit, expires_at, active, note)
  VALUES
    (_new_code, _s.referrer_discount_type, _s.referrer_discount_value, _s.referrer_min_order, 1, 1, _expires, true, 'Cupom de indicação (indicou amigo)')
  RETURNING id INTO _coupon_id;

  UPDATE public.referral_events
    SET status='rewarded', referrer_coupon_id=_coupon_id, order_id=NEW.id, rewarded_at=now()
   WHERE id = _ev.id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_reward_referrer_on_paid ON public.orders;
CREATE TRIGGER trg_reward_referrer_on_paid
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.reward_referrer_on_paid();

-- My referrals
CREATE OR REPLACE FUNCTION public.get_my_referrals()
RETURNS TABLE(id uuid, referee_email text, referee_name text, status text, created_at timestamptz, rewarded_at timestamptz, referrer_coupon_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT e.id, u.email::text, COALESCE(p.full_name,''), e.status, e.created_at, e.rewarded_at, c.code
    FROM public.referral_events e
    LEFT JOIN auth.users u ON u.id = e.referee_user_id
    LEFT JOIN public.profiles p ON p.id = e.referee_user_id
    LEFT JOIN public.promo_coupons c ON c.id = e.referrer_coupon_id
    WHERE e.referrer_user_id = _uid
    ORDER BY e.created_at DESC;
END; $$;
REVOKE ALL ON FUNCTION public.get_my_referrals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referrals() TO authenticated;

-- Admin list all
CREATE OR REPLACE FUNCTION public.admin_list_referrals(_limit int DEFAULT 200)
RETURNS TABLE(id uuid, referrer_email text, referrer_name text, referee_email text, referee_name text, code text, status text, created_at timestamptz, rewarded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  RETURN QUERY
    SELECT e.id, ur.email::text, COALESCE(pr.full_name,''), ue.email::text, COALESCE(pe.full_name,''),
           e.code, e.status, e.created_at, e.rewarded_at
    FROM public.referral_events e
    LEFT JOIN auth.users ur ON ur.id = e.referrer_user_id
    LEFT JOIN public.profiles pr ON pr.id = e.referrer_user_id
    LEFT JOIN auth.users ue ON ue.id = e.referee_user_id
    LEFT JOIN public.profiles pe ON pe.id = e.referee_user_id
    ORDER BY e.created_at DESC LIMIT _limit;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_referrals(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_referrals(int) TO authenticated;

-- Admin update settings
CREATE OR REPLACE FUNCTION public.admin_update_referral_settings(_payload jsonb)
RETURNS public.referral_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _row public.referral_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  UPDATE public.referral_settings SET
    enabled = COALESCE((_payload->>'enabled')::boolean, enabled),
    referrer_discount_type = COALESCE(_payload->>'referrer_discount_type', referrer_discount_type),
    referrer_discount_value = COALESCE((_payload->>'referrer_discount_value')::numeric, referrer_discount_value),
    referrer_min_order = COALESCE((_payload->>'referrer_min_order')::numeric, referrer_min_order),
    referee_discount_type = COALESCE(_payload->>'referee_discount_type', referee_discount_type),
    referee_discount_value = COALESCE((_payload->>'referee_discount_value')::numeric, referee_discount_value),
    referee_min_order = COALESCE((_payload->>'referee_min_order')::numeric, referee_min_order),
    expires_days = COALESCE((_payload->>'expires_days')::int, expires_days),
    require_first_order = COALESCE((_payload->>'require_first_order')::boolean, require_first_order),
    max_referrals_per_user = CASE WHEN _payload ? 'max_referrals_per_user'
      THEN NULLIF(_payload->>'max_referrals_per_user','')::int ELSE max_referrals_per_user END,
    share_message = COALESCE(_payload->>'share_message', share_message),
    updated_at = now()
  WHERE id=1 RETURNING * INTO _row;
  RETURN _row;
END; $$;
REVOKE ALL ON FUNCTION public.admin_update_referral_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_referral_settings(jsonb) TO authenticated;
