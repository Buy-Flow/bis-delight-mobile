
CREATE TABLE public.birthday_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year int NOT NULL,
  coupon_id uuid REFERENCES public.promo_coupons(id) ON DELETE SET NULL,
  coupon_code text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  UNIQUE (user_id, year)
);

GRANT SELECT, INSERT, UPDATE ON public.birthday_gifts TO authenticated;
GRANT ALL ON public.birthday_gifts TO service_role;

ALTER TABLE public.birthday_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own gifts" ON public.birthday_gifts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all gifts" ON public.birthday_gifts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_birthday_gift_status()
RETURNS TABLE(is_birthday_month boolean, birthday date, gift_code text, gift_used boolean, gift_expires_at timestamptz, discount_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _bday date;
  _current_year int := extract(year from now())::int;
  _gift record;
  _coupon record;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  SELECT p.birthday INTO _bday FROM public.profiles p WHERE p.id = _uid;

  IF _bday IS NULL THEN
    RETURN QUERY SELECT false, NULL::date, NULL::text, NULL::boolean, NULL::timestamptz, NULL::numeric;
    RETURN;
  END IF;

  SELECT * INTO _gift FROM public.birthday_gifts
    WHERE user_id = _uid AND year = _current_year LIMIT 1;

  IF _gift.id IS NOT NULL THEN
    SELECT * INTO _coupon FROM public.promo_coupons WHERE id = _gift.coupon_id;
    RETURN QUERY SELECT
      (extract(month from _bday)::int = extract(month from now())::int),
      _bday,
      _gift.coupon_code,
      (_gift.used_at IS NOT NULL),
      _coupon.expires_at,
      _coupon.discount_value;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    (extract(month from _bday)::int = extract(month from now())::int),
    _bday,
    NULL::text, NULL::boolean, NULL::timestamptz, NULL::numeric;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_birthday_gift()
RETURNS TABLE(code text, discount_value numeric, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _bday date;
  _current_year int := extract(year from now())::int;
  _existing record;
  _new_code text;
  _coupon_id uuid;
  _expires timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT birthday INTO _bday FROM public.profiles WHERE id = _uid;
  IF _bday IS NULL THEN
    RAISE EXCEPTION 'birthday_not_set' USING ERRCODE = 'P0001';
  END IF;

  IF extract(month from _bday)::int <> extract(month from now())::int THEN
    RAISE EXCEPTION 'not_birthday_month' USING ERRCODE = 'P0001';
  END IF;

  SELECT g.*, c.expires_at AS c_expires, c.discount_value AS c_disc
    INTO _existing
    FROM public.birthday_gifts g
    LEFT JOIN public.promo_coupons c ON c.id = g.coupon_id
   WHERE g.user_id = _uid AND g.year = _current_year LIMIT 1;

  IF _existing.id IS NOT NULL THEN
    RETURN QUERY SELECT _existing.coupon_code, _existing.c_disc, _existing.c_expires;
    RETURN;
  END IF;

  _new_code := 'ANIV-' || upper(substring(replace(gen_random_uuid()::text,'-',''), 1, 6));
  _expires := date_trunc('month', now()) + interval '1 month' - interval '1 second';

  INSERT INTO public.promo_coupons
    (code, discount_type, discount_value, min_order, max_uses, per_user_limit, expires_at, active, note)
  VALUES
    (_new_code, 'fixed', 15, 25, 1, 1, _expires, true, 'Brinde de aniversário 🎂')
  RETURNING id INTO _coupon_id;

  INSERT INTO public.birthday_gifts (user_id, year, coupon_id, coupon_code)
    VALUES (_uid, _current_year, _coupon_id, _new_code);

  RETURN QUERY SELECT _new_code, 15::numeric, _expires;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_birthday_gift_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_birthday_gift() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_birthday_gift_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_birthday_gift() TO authenticated;

INSERT INTO public.push_automations (kind, name, title, body, url, active, config)
VALUES (
  'birthday',
  'Aniversariante do Mês',
  '🎂 Feliz Aniversário!',
  'Você ganhou R$ 15 de desconto no seu açaí. Resgate agora!',
  '/',
  true,
  '{"discount":15,"min_order":25}'::jsonb
)
ON CONFLICT DO NOTHING;
