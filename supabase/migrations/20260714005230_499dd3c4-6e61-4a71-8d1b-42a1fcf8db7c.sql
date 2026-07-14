
CREATE TABLE public.sla_settings (
  id INT PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  mode TEXT NOT NULL DEFAULT 'fixed' CHECK (mode IN ('fixed','historical')),
  -- fixed thresholds in minutes for total order age (created_at → done)
  green_max_entrega INT NOT NULL DEFAULT 20,
  yellow_max_entrega INT NOT NULL DEFAULT 40,
  green_max_retirada INT NOT NULL DEFAULT 15,
  yellow_max_retirada INT NOT NULL DEFAULT 25,
  green_max_mesa INT NOT NULL DEFAULT 10,
  yellow_max_mesa INT NOT NULL DEFAULT 20,
  -- historical mode multipliers vs historical average
  historical_green_factor NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  historical_yellow_factor NUMERIC(4,2) NOT NULL DEFAULT 1.50,
  historical_lookback_days INT NOT NULL DEFAULT 30,
  warn_before_red_pct INT NOT NULL DEFAULT 80,
  auto_notify_admin BOOLEAN NOT NULL DEFAULT true,
  auto_notify_on TEXT NOT NULL DEFAULT 'red' CHECK (auto_notify_on IN ('yellow','red')),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sla_settings TO authenticated;
GRANT ALL ON public.sla_settings TO service_role;

ALTER TABLE public.sla_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_settings_read_authenticated" ON public.sla_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sla_settings_admin_write" ON public.sla_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_sla_settings_updated
BEFORE UPDATE ON public.sla_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sla_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_sla_history(lookback_days INT DEFAULT 30)
RETURNS TABLE(mode TEXT, avg_minutes NUMERIC, p50_minutes NUMERIC, p90_minutes NUMERIC, sample_size INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.mode,
    ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(o.dispatched_at, o.delivered_at) - o.created_at))/60)::numeric, 1) AS avg_minutes,
    ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (COALESCE(o.dispatched_at, o.delivered_at) - o.created_at))/60))::numeric, 1) AS p50_minutes,
    ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (COALESCE(o.dispatched_at, o.delivered_at) - o.created_at))/60))::numeric, 1) AS p90_minutes,
    COUNT(*)::int AS sample_size
  FROM public.orders o
  WHERE o.created_at >= now() - (lookback_days || ' days')::interval
    AND COALESCE(o.dispatched_at, o.delivered_at) IS NOT NULL
    AND o.status IN ('entregue','saiu_para_entrega')
  GROUP BY o.mode;
$$;

REVOKE ALL ON FUNCTION public.get_sla_history(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sla_history(INT) TO authenticated, service_role;
