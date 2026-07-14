
DROP FUNCTION IF EXISTS public.get_birthday_gift_status();
DROP FUNCTION IF EXISTS public.claim_birthday_gift();

CREATE TABLE IF NOT EXISTS public.birthday_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  discount_type text NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed','percent')),
  discount_value numeric NOT NULL DEFAULT 15,
  min_order numeric NOT NULL DEFAULT 25,
  validity_mode text NOT NULL DEFAULT 'month' CHECK (validity_mode IN ('month','days_from_claim')),
  validity_days int NOT NULL DEFAULT 30,
  per_user_yearly int NOT NULL DEFAULT 1,
  banner_emoji text NOT NULL DEFAULT '🎂',
  banner_title text NOT NULL DEFAULT 'Você ganhou um brinde!',
  banner_message text NOT NULL DEFAULT 'Toque em resgatar e receba seu desconto de aniversário.',
  banner_cta text NOT NULL DEFAULT 'Resgatar meu brinde',
  push_auto boolean NOT NULL DEFAULT true,
  push_title text NOT NULL DEFAULT 'Feliz aniversário! 🎂',
  push_body text NOT NULL DEFAULT 'Você ganhou um cupom exclusivo. Aproveite hoje!',
  notify_days_before int NOT NULL DEFAULT 0,
  coupon_prefix text NOT NULL DEFAULT 'ANIV',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.birthday_settings TO authenticated;
GRANT ALL ON public.birthday_settings TO service_role;
ALTER TABLE public.birthday_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "birthday_settings admin manage" ON public.birthday_settings;
CREATE POLICY "birthday_settings admin manage" ON public.birthday_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "birthday_settings read" ON public.birthday_settings;
CREATE POLICY "birthday_settings read" ON public.birthday_settings FOR SELECT TO authenticated USING (true);
INSERT INTO public.birthday_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
DROP TRIGGER IF EXISTS trg_birthday_settings_updated ON public.birthday_settings;
CREATE TRIGGER trg_birthday_settings_updated BEFORE UPDATE ON public.birthday_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.birthday_gifts ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;
ALTER TABLE public.birthday_gifts ADD COLUMN IF NOT EXISTS granted_by uuid;
ALTER TABLE public.birthday_gifts ADD COLUMN IF NOT EXISTS notes text;

CREATE OR REPLACE FUNCTION public.get_birthday_gift_status()
RETURNS TABLE(
  is_birthday_month boolean, is_birthday_today boolean, birthday date,
  gift_code text, gift_used boolean, gift_expires_at timestamptz,
  discount_value numeric, discount_type text, min_order numeric,
  banner_title text, banner_message text, banner_cta text, banner_emoji text,
  program_enabled boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _bday date; _year int := extract(year from now())::int;
  _gift record; _coupon record; _s public.birthday_settings%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT * INTO _s FROM public.birthday_settings WHERE id = 1;
  SELECT p.birthday INTO _bday FROM public.profiles p WHERE p.id = _uid;
  IF _bday IS NULL OR NOT COALESCE(_s.enabled,false) THEN
    RETURN QUERY SELECT false, false, _bday, NULL::text, NULL::boolean, NULL::timestamptz,
      _s.discount_value, _s.discount_type, _s.min_order,
      _s.banner_title, _s.banner_message, _s.banner_cta, _s.banner_emoji,
      COALESCE(_s.enabled,false);
    RETURN;
  END IF;
  SELECT * INTO _gift FROM public.birthday_gifts WHERE user_id = _uid AND year = _year LIMIT 1;
  IF _gift.id IS NOT NULL THEN SELECT * INTO _coupon FROM public.promo_coupons WHERE id = _gift.coupon_id; END IF;
  RETURN QUERY SELECT
    (extract(month from _bday)::int = extract(month from now())::int),
    (extract(month from _bday)::int = extract(month from now())::int
      AND extract(day from _bday)::int = extract(day from now())::int),
    _bday, _gift.coupon_code,
    CASE WHEN _gift.id IS NOT NULL THEN (_gift.used_at IS NOT NULL) ELSE NULL END,
    _coupon.expires_at,
    COALESCE(_coupon.discount_value, _s.discount_value),
    COALESCE(_coupon.discount_type, _s.discount_type),
    _s.min_order,
    _s.banner_title, _s.banner_message, _s.banner_cta, _s.banner_emoji, true;
END; $$;
REVOKE ALL ON FUNCTION public.get_birthday_gift_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_birthday_gift_status() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_birthday_gift()
RETURNS TABLE(code text, discount_value numeric, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _bday date; _year int := extract(year from now())::int;
  _existing record; _new_code text; _coupon_id uuid; _expires timestamptz;
  _s public.birthday_settings%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;
  SELECT * INTO _s FROM public.birthday_settings WHERE id = 1;
  IF NOT COALESCE(_s.enabled,false) THEN RAISE EXCEPTION 'program_disabled' USING ERRCODE='P0001'; END IF;
  SELECT birthday INTO _bday FROM public.profiles WHERE id = _uid;
  IF _bday IS NULL THEN RAISE EXCEPTION 'birthday_not_set' USING ERRCODE='P0001'; END IF;
  IF extract(month from _bday)::int <> extract(month from now())::int THEN
    RAISE EXCEPTION 'not_birthday_month' USING ERRCODE='P0001';
  END IF;
  SELECT g.*, c.expires_at AS c_expires, c.discount_value AS c_disc
    INTO _existing FROM public.birthday_gifts g
    LEFT JOIN public.promo_coupons c ON c.id = g.coupon_id
    WHERE g.user_id = _uid AND g.year = _year LIMIT 1;
  IF _existing.id IS NOT NULL THEN
    RETURN QUERY SELECT _existing.coupon_code, _existing.c_disc, _existing.c_expires; RETURN;
  END IF;
  _new_code := COALESCE(NULLIF(_s.coupon_prefix,''),'ANIV') || '-' ||
    upper(substring(replace(gen_random_uuid()::text,'-',''), 1, 6));
  IF _s.validity_mode = 'days_from_claim' THEN
    _expires := now() + make_interval(days => GREATEST(_s.validity_days, 1));
  ELSE
    _expires := date_trunc('month', now()) + interval '1 month' - interval '1 second';
  END IF;
  INSERT INTO public.promo_coupons
    (code, discount_type, discount_value, min_order, max_uses, per_user_limit, expires_at, active, note)
  VALUES (_new_code, _s.discount_type, _s.discount_value, _s.min_order,
    GREATEST(_s.per_user_yearly,1), GREATEST(_s.per_user_yearly,1),
    _expires, true, 'Brinde de aniversário 🎂')
  RETURNING id INTO _coupon_id;
  INSERT INTO public.birthday_gifts (user_id, year, coupon_id, coupon_code)
    VALUES (_uid, _year, _coupon_id, _new_code);
  RETURN QUERY SELECT _new_code, _s.discount_value, _expires;
END; $$;
REVOKE ALL ON FUNCTION public.claim_birthday_gift() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_birthday_gift() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_birthday_settings()
RETURNS SETOF public.birthday_settings
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT * FROM public.birthday_settings WHERE id = 1;
END; $$;
REVOKE ALL ON FUNCTION public.admin_get_birthday_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_birthday_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_birthday_settings(_patch jsonb)
RETURNS public.birthday_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.birthday_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  UPDATE public.birthday_settings SET
    enabled = COALESCE((_patch->>'enabled')::boolean, enabled),
    discount_type = COALESCE(_patch->>'discount_type', discount_type),
    discount_value = COALESCE((_patch->>'discount_value')::numeric, discount_value),
    min_order = COALESCE((_patch->>'min_order')::numeric, min_order),
    validity_mode = COALESCE(_patch->>'validity_mode', validity_mode),
    validity_days = COALESCE((_patch->>'validity_days')::int, validity_days),
    per_user_yearly = COALESCE((_patch->>'per_user_yearly')::int, per_user_yearly),
    banner_emoji = COALESCE(_patch->>'banner_emoji', banner_emoji),
    banner_title = COALESCE(_patch->>'banner_title', banner_title),
    banner_message = COALESCE(_patch->>'banner_message', banner_message),
    banner_cta = COALESCE(_patch->>'banner_cta', banner_cta),
    push_auto = COALESCE((_patch->>'push_auto')::boolean, push_auto),
    push_title = COALESCE(_patch->>'push_title', push_title),
    push_body = COALESCE(_patch->>'push_body', push_body),
    notify_days_before = COALESCE((_patch->>'notify_days_before')::int, notify_days_before),
    coupon_prefix = COALESCE(_patch->>'coupon_prefix', coupon_prefix)
   WHERE id = 1 RETURNING * INTO _row;
  RETURN _row;
END; $$;
REVOKE ALL ON FUNCTION public.admin_update_birthday_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_birthday_settings(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_birthday_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'total_with_birthday', (SELECT count(*) FROM public.profiles WHERE birthday IS NOT NULL),
    'this_month', (SELECT count(*) FROM public.profiles WHERE birthday IS NOT NULL
      AND extract(month from birthday) = extract(month from now())),
    'today', (SELECT count(*) FROM public.profiles WHERE birthday IS NOT NULL
      AND extract(month from birthday) = extract(month from now())
      AND extract(day from birthday) = extract(day from now())),
    'gifts_claimed_year', (SELECT count(*) FROM public.birthday_gifts WHERE year = extract(year from now())::int),
    'gifts_used_year', (SELECT count(*) FROM public.birthday_gifts WHERE year = extract(year from now())::int AND used_at IS NOT NULL),
    'push_sent_year', (SELECT count(*) FROM public.birthday_gifts WHERE year = extract(year from now())::int AND push_sent_at IS NOT NULL)
  ) INTO _r; RETURN _r;
END; $$;
REVOKE ALL ON FUNCTION public.admin_birthday_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_birthday_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_upcoming_birthdays(_days int DEFAULT 30)
RETURNS TABLE(user_id uuid, full_name text, email text, phone text, birthday date,
  days_until int, gift_claimed boolean, gift_code text, push_sent boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _y int := extract(year from now())::int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  RETURN QUERY
  WITH bd AS (
    SELECT p.id, p.full_name, p.phone, p.birthday,
      make_date(_y, extract(month from p.birthday)::int, LEAST(extract(day from p.birthday)::int,28)) AS this_year
    FROM public.profiles p WHERE p.birthday IS NOT NULL
  )
  SELECT bd.id, bd.full_name, u.email::text, bd.phone, bd.birthday,
    (CASE WHEN bd.this_year >= current_date THEN (bd.this_year - current_date)
          ELSE (bd.this_year + interval '1 year')::date - current_date END)::int AS days_until,
    (g.id IS NOT NULL), g.coupon_code, (g.push_sent_at IS NOT NULL)
  FROM bd LEFT JOIN auth.users u ON u.id = bd.id
  LEFT JOIN public.birthday_gifts g ON g.user_id = bd.id AND g.year = _y
  WHERE (CASE WHEN bd.this_year >= current_date THEN (bd.this_year - current_date)
              ELSE (bd.this_year + interval '1 year')::date - current_date END)::int <= _days
  ORDER BY days_until ASC, bd.full_name ASC;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_upcoming_birthdays(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_upcoming_birthdays(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_birthday_history(_limit int DEFAULT 200)
RETURNS TABLE(gift_id uuid, user_id uuid, full_name text, email text, year int,
  coupon_code text, coupon_expires_at timestamptz, used_at timestamptz,
  push_sent_at timestamptz, granted_by_email text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  RETURN QUERY
  SELECT g.id, g.user_id, p.full_name, u.email::text, g.year,
    g.coupon_code, c.expires_at, g.used_at, g.push_sent_at,
    ub.email::text, g.created_at
  FROM public.birthday_gifts g
  LEFT JOIN public.profiles p ON p.id = g.user_id
  LEFT JOIN auth.users u ON u.id = g.user_id
  LEFT JOIN auth.users ub ON ub.id = g.granted_by
  LEFT JOIN public.promo_coupons c ON c.id = g.coupon_id
  ORDER BY g.created_at DESC LIMIT GREATEST(_limit,1);
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_birthday_history(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_birthday_history(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_send_birthday_gift(_user_id uuid, _note text DEFAULT NULL)
RETURNS TABLE(code text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s public.birthday_settings%ROWTYPE; _y int := extract(year from now())::int;
  _existing record; _new_code text; _cid uuid; _expires timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  SELECT * INTO _s FROM public.birthday_settings WHERE id = 1;
  SELECT * INTO _existing FROM public.birthday_gifts WHERE user_id = _user_id AND year = _y LIMIT 1;
  IF _existing.id IS NOT NULL THEN
    SELECT expires_at INTO _expires FROM public.promo_coupons WHERE id = _existing.coupon_id;
    RETURN QUERY SELECT _existing.coupon_code, _expires; RETURN;
  END IF;
  _new_code := COALESCE(NULLIF(_s.coupon_prefix,''),'ANIV') || '-' ||
    upper(substring(replace(gen_random_uuid()::text,'-',''), 1, 6));
  IF _s.validity_mode = 'days_from_claim' THEN
    _expires := now() + make_interval(days => GREATEST(_s.validity_days, 1));
  ELSE
    _expires := date_trunc('month', now()) + interval '1 month' - interval '1 second';
  END IF;
  INSERT INTO public.promo_coupons
    (code, discount_type, discount_value, min_order, max_uses, per_user_limit, expires_at, active, note)
  VALUES (_new_code, _s.discount_type, _s.discount_value, _s.min_order,
    GREATEST(_s.per_user_yearly,1), GREATEST(_s.per_user_yearly,1),
    _expires, true, COALESCE(_note,'Brinde de aniversário 🎂 (manual)'))
  RETURNING id INTO _cid;
  INSERT INTO public.birthday_gifts (user_id, year, coupon_id, coupon_code, granted_by, notes)
    VALUES (_user_id, _y, _cid, _new_code, auth.uid(), _note);
  RETURN QUERY SELECT _new_code, _expires;
END; $$;
REVOKE ALL ON FUNCTION public.admin_send_birthday_gift(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_send_birthday_gift(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_birthday_push_sent(_gift_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.birthday_gifts SET push_sent_at = now() WHERE id = _gift_id AND push_sent_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.mark_birthday_push_sent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_birthday_push_sent(uuid) TO service_role;
