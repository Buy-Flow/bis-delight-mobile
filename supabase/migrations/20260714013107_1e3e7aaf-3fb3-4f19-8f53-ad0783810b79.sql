
-- 1) Settings singleton
CREATE TABLE IF NOT EXISTS public.winback_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  days_inactive int NOT NULL DEFAULT 30 CHECK (days_inactive BETWEEN 7 AND 365),
  min_orders int NOT NULL DEFAULT 1 CHECK (min_orders >= 1),
  min_lifetime_spent numeric NOT NULL DEFAULT 0 CHECK (min_lifetime_spent >= 0),
  require_phone boolean NOT NULL DEFAULT true,
  cooldown_days int NOT NULL DEFAULT 60 CHECK (cooldown_days BETWEEN 7 AND 365),
  max_per_run int NOT NULL DEFAULT 50 CHECK (max_per_run BETWEEN 1 AND 500),
  send_hour int NOT NULL DEFAULT 10 CHECK (send_hour BETWEEN 0 AND 23),
  send_minute int NOT NULL DEFAULT 0 CHECK (send_minute BETWEEN 0 AND 59),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  weekdays int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  coupon_prefix text NOT NULL DEFAULT 'VOLTA',
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric NOT NULL DEFAULT 15 CHECK (discount_value > 0),
  min_order numeric NOT NULL DEFAULT 0 CHECK (min_order >= 0),
  validity_days int NOT NULL DEFAULT 14 CHECK (validity_days BETWEEN 1 AND 90),
  message_template text NOT NULL DEFAULT 'Oi {nome}! Tá com saudade da gente 🥺❤️ Volta hoje e ganha {desconto} de desconto — cupom: *{cupom}* (válido por {validade} dias). Faz seu pedido: {link}',
  push_title text NOT NULL DEFAULT 'Tá com saudade? A gente também 🥺',
  push_body text NOT NULL DEFAULT '{desconto} pra voltar pro nosso açaí. Cupom {cupom} — toque pra pedir.',
  send_whatsapp boolean NOT NULL DEFAULT true,
  send_push boolean NOT NULL DEFAULT true,
  order_link_path text NOT NULL DEFAULT '/',
  last_run_at timestamptz,
  last_run_status text,
  last_run_error text,
  last_run_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.winback_settings TO authenticated;
GRANT ALL ON public.winback_settings TO service_role;
ALTER TABLE public.winback_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "winback_settings admin read" ON public.winback_settings;
CREATE POLICY "winback_settings admin read"
  ON public.winback_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

INSERT INTO public.winback_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_winback_settings_updated_at ON public.winback_settings;
CREATE TRIGGER trg_winback_settings_updated_at
BEFORE UPDATE ON public.winback_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Sends log
CREATE TABLE IF NOT EXISTS public.winback_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text,
  coupon_id uuid,
  coupon_code text,
  channel text NOT NULL,       -- 'whatsapp' | 'push' | 'both' | 'none'
  status text NOT NULL,        -- 'sent' | 'failed' | 'partial' | 'skipped'
  whatsapp_ok boolean,
  push_ok boolean,
  error text,
  message text,
  triggered_by text NOT NULL DEFAULT 'cron' CHECK (triggered_by IN ('cron','manual')),
  triggered_user uuid,
  days_since_last_order int,
  last_order_at timestamptz,
  discount_type text,
  discount_value numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_winback_sends_user ON public.winback_sends(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_winback_sends_created ON public.winback_sends(created_at DESC);

GRANT SELECT ON public.winback_sends TO authenticated;
GRANT ALL ON public.winback_sends TO service_role;
ALTER TABLE public.winback_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "winback_sends admin read" ON public.winback_sends;
CREATE POLICY "winback_sends admin read"
  ON public.winback_sends FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- 3) Candidate finder (security definer, admin/manager only)
CREATE OR REPLACE FUNCTION public.get_winback_candidates(
  _days int DEFAULT 30,
  _min_orders int DEFAULT 1,
  _min_spent numeric DEFAULT 0,
  _require_phone boolean DEFAULT true,
  _cooldown_days int DEFAULT 60,
  _limit int DEFAULT 50
)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  email text,
  phone text,
  orders_count bigint,
  lifetime_spent numeric,
  last_order_at timestamptz,
  days_since_last_order int,
  last_winback_at timestamptz,
  avg_ticket numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH stats AS (
    SELECT o.user_id,
           count(*)::bigint AS orders_count,
           sum(o.total)::numeric AS lifetime_spent,
           max(COALESCE(o.paid_at, o.created_at)) AS last_order_at,
           avg(o.total)::numeric AS avg_ticket
    FROM public.orders o
    WHERE o.user_id IS NOT NULL AND o.status = 'pago'
    GROUP BY o.user_id
  ), last_wb AS (
    SELECT ws.user_id, max(ws.created_at) AS last_winback_at
    FROM public.winback_sends ws
    WHERE ws.status IN ('sent','partial')
    GROUP BY ws.user_id
  )
  SELECT s.user_id,
         COALESCE(p.full_name,'') AS full_name,
         u.email::text,
         p.phone,
         s.orders_count,
         s.lifetime_spent,
         s.last_order_at,
         EXTRACT(day FROM (now() - s.last_order_at))::int AS days_since_last_order,
         lw.last_winback_at,
         s.avg_ticket
  FROM stats s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN auth.users u ON u.id = s.user_id
  LEFT JOIN last_wb lw ON lw.user_id = s.user_id
  WHERE s.orders_count >= GREATEST(_min_orders, 1)
    AND s.lifetime_spent >= COALESCE(_min_spent, 0)
    AND s.last_order_at < now() - make_interval(days => GREATEST(_days,1))
    AND (NOT _require_phone OR (p.phone IS NOT NULL AND length(btrim(p.phone)) >= 8))
    AND (lw.last_winback_at IS NULL OR lw.last_winback_at < now() - make_interval(days => GREATEST(_cooldown_days,1)))
  ORDER BY s.last_order_at ASC
  LIMIT GREATEST(_limit, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.get_winback_candidates(int,int,numeric,boolean,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_winback_candidates(int,int,numeric,boolean,int,int) TO authenticated, service_role;

-- 4) KPI helper
CREATE OR REPLACE FUNCTION public.get_winback_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  WITH s AS (
    SELECT
      count(*) FILTER (WHERE status IN ('sent','partial')) AS sent_total,
      count(*) FILTER (WHERE status IN ('sent','partial') AND created_at >= now() - interval '30 days') AS sent_30d,
      count(*) FILTER (WHERE status = 'failed') AS failed_total,
      count(DISTINCT user_id) FILTER (WHERE status IN ('sent','partial')) AS unique_users
    FROM public.winback_sends
  ),
  redemp AS (
    SELECT count(DISTINCT ws.user_id) AS redeemed
    FROM public.winback_sends ws
    JOIN public.promo_coupon_redemptions r ON r.coupon_id = ws.coupon_id AND r.user_id = ws.user_id
    WHERE ws.status IN ('sent','partial') AND ws.created_at >= now() - interval '90 days'
  )
  SELECT jsonb_build_object(
    'sent_total', COALESCE(s.sent_total,0),
    'sent_30d', COALESCE(s.sent_30d,0),
    'failed_total', COALESCE(s.failed_total,0),
    'unique_users', COALESCE(s.unique_users,0),
    'redeemed_90d', COALESCE(r.redeemed,0)
  ) INTO _r FROM s, redemp r;

  RETURN _r;
END;
$$;

REVOKE ALL ON FUNCTION public.get_winback_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_winback_stats() TO authenticated, service_role;
