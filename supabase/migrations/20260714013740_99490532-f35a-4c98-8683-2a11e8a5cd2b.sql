-- VIP Ranking Gamification
CREATE TABLE IF NOT EXISTS public.vip_ranking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  show_percentile boolean NOT NULL DEFAULT true,
  show_rank boolean NOT NULL DEFAULT true,
  show_leaderboard boolean NOT NULL DEFAULT true,
  leaderboard_size integer NOT NULL DEFAULT 10,
  mask_leaderboard_names boolean NOT NULL DEFAULT true,
  top_badge_percent integer NOT NULL DEFAULT 5, -- "Top X% dos clientes"
  min_orders_to_rank integer NOT NULL DEFAULT 1,
  metric text NOT NULL DEFAULT 'ltv', -- ltv | orders | hybrid
  tiers jsonb NOT NULL DEFAULT '[
    {"key":"novato","name":"Novato","emoji":"🌱","color":"#94a3b8","min_ltv":0,"min_orders":0,"perks":"Bem-vindo! Faça seu primeiro pedido."},
    {"key":"bronze","name":"Bronze","emoji":"🥉","color":"#cd7f32","min_ltv":100,"min_orders":3,"perks":"Cupom de 5% no aniversário."},
    {"key":"prata","name":"Prata","emoji":"🥈","color":"#c0c0c0","min_ltv":300,"min_orders":10,"perks":"Frete grátis nas terças + selo duplo."},
    {"key":"ouro","name":"Ouro","emoji":"🥇","color":"#facc15","min_ltv":800,"min_orders":25,"perks":"Frete grátis sempre + brinde surpresa mensal."},
    {"key":"diamante","name":"Diamante","emoji":"💎","color":"#22d3ee","min_ltv":2000,"min_orders":60,"perks":"Atendimento VIP + acesso antecipado a novidades."}
  ]'::jsonb,
  hero_title text NOT NULL DEFAULT 'Ranking VIP',
  hero_subtitle text NOT NULL DEFAULT 'Quanto mais você pede, mais alto você sobe. Status vende!',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vip_ranking_settings TO anon, authenticated;
GRANT ALL ON public.vip_ranking_settings TO service_role;
ALTER TABLE public.vip_ranking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vip_ranking_settings public read" ON public.vip_ranking_settings FOR SELECT USING (true);
CREATE POLICY "vip_ranking_settings admin write" ON public.vip_ranking_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

INSERT INTO public.vip_ranking_settings (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;

-- RPC: get customer ranking for the CURRENT user (auth.uid())
CREATE OR REPLACE FUNCTION public.get_customer_ranking()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.vip_ranking_settings;
  uid uuid := auth.uid();
  user_ltv numeric := 0;
  user_orders integer := 0;
  user_last timestamptz;
  total_ranked integer := 0;
  user_rank integer := 0;
  percentile numeric := 100;
  current_tier jsonb;
  next_tier jsonb;
  tiers_arr jsonb;
BEGIN
  SELECT * INTO s FROM public.vip_ranking_settings WHERE singleton = true LIMIT 1;
  IF uid IS NULL OR s IS NULL OR s.enabled = false THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  SELECT COALESCE(SUM(total),0)::numeric, COUNT(*)::int, MAX(created_at)
    INTO user_ltv, user_orders, user_last
  FROM public.orders
  WHERE user_id = uid AND status NOT IN ('cancelado','cancelled');

  WITH agg AS (
    SELECT user_id, SUM(total)::numeric AS ltv, COUNT(*)::int AS orders_ct
    FROM public.orders
    WHERE user_id IS NOT NULL AND status NOT IN ('cancelado','cancelled')
    GROUP BY user_id
    HAVING COUNT(*) >= s.min_orders_to_rank
  ),
  ranked AS (
    SELECT user_id,
      CASE s.metric
        WHEN 'orders' THEN ROW_NUMBER() OVER (ORDER BY orders_ct DESC, ltv DESC)
        WHEN 'hybrid' THEN ROW_NUMBER() OVER (ORDER BY (ltv * 0.7 + orders_ct * 30) DESC)
        ELSE ROW_NUMBER() OVER (ORDER BY ltv DESC, orders_ct DESC)
      END AS rk,
      COUNT(*) OVER () AS total
    FROM agg
  )
  SELECT rk, total INTO user_rank, total_ranked FROM ranked WHERE user_id = uid;

  IF total_ranked > 0 AND user_rank > 0 THEN
    percentile := ROUND((user_rank::numeric / total_ranked::numeric) * 100, 1);
  END IF;

  tiers_arr := s.tiers;
  SELECT t INTO current_tier FROM jsonb_array_elements(tiers_arr) t
    WHERE user_ltv >= COALESCE((t->>'min_ltv')::numeric,0)
      AND user_orders >= COALESCE((t->>'min_orders')::int,0)
    ORDER BY COALESCE((t->>'min_ltv')::numeric,0) DESC, COALESCE((t->>'min_orders')::int,0) DESC
    LIMIT 1;

  SELECT t INTO next_tier FROM jsonb_array_elements(tiers_arr) t
    WHERE (user_ltv < COALESCE((t->>'min_ltv')::numeric,0)
        OR user_orders < COALESCE((t->>'min_orders')::int,0))
    ORDER BY COALESCE((t->>'min_ltv')::numeric,0) ASC, COALESCE((t->>'min_orders')::int,0) ASC
    LIMIT 1;

  RETURN jsonb_build_object(
    'enabled', true,
    'settings', jsonb_build_object(
      'show_percentile', s.show_percentile,
      'show_rank', s.show_rank,
      'show_leaderboard', s.show_leaderboard,
      'top_badge_percent', s.top_badge_percent,
      'hero_title', s.hero_title,
      'hero_subtitle', s.hero_subtitle
    ),
    'user_ltv', user_ltv,
    'user_orders', user_orders,
    'user_last', user_last,
    'total_ranked', total_ranked,
    'rank', user_rank,
    'percentile', percentile,
    'is_top', (percentile > 0 AND percentile <= s.top_badge_percent),
    'current_tier', current_tier,
    'next_tier', next_tier
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_ranking() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_ranking() TO authenticated;

-- RPC: leaderboard preview
CREATE OR REPLACE FUNCTION public.get_vip_leaderboard(_limit integer DEFAULT 10)
RETURNS TABLE(
  rank_pos integer,
  display_name text,
  ltv numeric,
  orders_ct integer,
  is_me boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.vip_ranking_settings;
  uid uuid := auth.uid();
  is_admin boolean := false;
BEGIN
  SELECT * INTO s FROM public.vip_ranking_settings WHERE singleton = true LIMIT 1;
  IF s IS NULL OR s.enabled = false OR s.show_leaderboard = false THEN RETURN; END IF;
  IF uid IS NOT NULL THEN
    is_admin := public.has_role(uid,'admin') OR public.has_role(uid,'manager');
  END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT o.user_id, SUM(o.total)::numeric AS ltv, COUNT(*)::int AS orders_ct
    FROM public.orders o
    WHERE o.user_id IS NOT NULL AND o.status NOT IN ('cancelado','cancelled')
    GROUP BY o.user_id
    HAVING COUNT(*) >= s.min_orders_to_rank
  ),
  ranked AS (
    SELECT a.user_id, a.ltv, a.orders_ct,
      (CASE s.metric
        WHEN 'orders' THEN ROW_NUMBER() OVER (ORDER BY a.orders_ct DESC, a.ltv DESC)
        WHEN 'hybrid' THEN ROW_NUMBER() OVER (ORDER BY (a.ltv * 0.7 + a.orders_ct * 30) DESC)
        ELSE ROW_NUMBER() OVER (ORDER BY a.ltv DESC, a.orders_ct DESC)
      END)::int AS rk
    FROM agg a
  )
  SELECT r.rk,
    CASE
      WHEN is_admin OR r.user_id = uid THEN COALESCE(p.name, 'Cliente #' || r.rk::text)
      WHEN s.mask_leaderboard_names THEN
        CASE WHEN COALESCE(p.name,'') = '' THEN 'Cliente #' || r.rk::text
             ELSE LEFT(p.name,1) || REPEAT('•', GREATEST(LENGTH(p.name)-2,2)) || RIGHT(p.name,1) END
      ELSE COALESCE(p.name, 'Cliente #' || r.rk::text)
    END,
    r.ltv,
    r.orders_ct,
    (r.user_id = uid)
  FROM ranked r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.rk <= GREATEST(_limit,1)
  ORDER BY r.rk;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vip_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vip_leaderboard(integer) TO authenticated, anon;

-- Admin RPC: full top-N with real names, LTV, orders (for the admin dashboard)
CREATE OR REPLACE FUNCTION public.get_vip_leaderboard_admin(_limit integer DEFAULT 50)
RETURNS TABLE(
  rank_pos integer,
  user_id uuid,
  name text,
  email text,
  phone text,
  ltv numeric,
  orders_ct integer,
  last_order timestamptz,
  tier_key text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.vip_ranking_settings;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin') OR public.has_role(uid,'manager')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO s FROM public.vip_ranking_settings WHERE singleton = true LIMIT 1;

  RETURN QUERY
  WITH agg AS (
    SELECT o.user_id, SUM(o.total)::numeric AS ltv, COUNT(*)::int AS orders_ct, MAX(o.created_at) AS last_order
    FROM public.orders o
    WHERE o.user_id IS NOT NULL AND o.status NOT IN ('cancelado','cancelled')
    GROUP BY o.user_id
    HAVING COUNT(*) >= COALESCE(s.min_orders_to_rank,1)
  ),
  ranked AS (
    SELECT a.*,
      (CASE COALESCE(s.metric,'ltv')
        WHEN 'orders' THEN ROW_NUMBER() OVER (ORDER BY a.orders_ct DESC, a.ltv DESC)
        WHEN 'hybrid' THEN ROW_NUMBER() OVER (ORDER BY (a.ltv * 0.7 + a.orders_ct * 30) DESC)
        ELSE ROW_NUMBER() OVER (ORDER BY a.ltv DESC, a.orders_ct DESC)
      END)::int AS rk
    FROM agg a
  )
  SELECT r.rk, r.user_id,
    COALESCE(p.name,'—'), p.email, p.phone,
    r.ltv, r.orders_ct, r.last_order,
    (SELECT t->>'key' FROM jsonb_array_elements(s.tiers) t
      WHERE r.ltv >= COALESCE((t->>'min_ltv')::numeric,0)
        AND r.orders_ct >= COALESCE((t->>'min_orders')::int,0)
      ORDER BY COALESCE((t->>'min_ltv')::numeric,0) DESC LIMIT 1)
  FROM ranked r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.rk <= GREATEST(_limit,1)
  ORDER BY r.rk;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vip_leaderboard_admin(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vip_leaderboard_admin(integer) TO authenticated;
