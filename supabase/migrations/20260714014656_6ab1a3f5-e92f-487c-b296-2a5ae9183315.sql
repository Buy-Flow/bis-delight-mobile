
-- Settings singleton for the proactive daily insights copilot
CREATE TABLE public.daily_insight_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  send_hour SMALLINT NOT NULL DEFAULT 9,
  send_minute SMALLINT NOT NULL DEFAULT 0,
  weekdays JSONB NOT NULL DEFAULT '[1,2,3,4,5,6]'::jsonb,
  min_severity TEXT NOT NULL DEFAULT 'info' CHECK (min_severity IN ('info','warning','critical')),
  compare_window_days SMALLINT NOT NULL DEFAULT 7,
  category_drop_threshold NUMERIC NOT NULL DEFAULT 20,   -- % queda para virar alerta
  product_drop_threshold NUMERIC NOT NULL DEFAULT 30,
  revenue_drop_threshold NUMERIC NOT NULL DEFAULT 15,
  rating_drop_threshold NUMERIC NOT NULL DEFAULT 0.5,    -- pontos absolutos (ex: 4.6 -> 4.1)
  cart_abandon_threshold NUMERIC NOT NULL DEFAULT 40,    -- % de carrinhos abandonados vs total
  monitor_categories BOOLEAN NOT NULL DEFAULT true,
  monitor_products BOOLEAN NOT NULL DEFAULT true,
  monitor_revenue BOOLEAN NOT NULL DEFAULT true,
  monitor_reviews BOOLEAN NOT NULL DEFAULT true,
  monitor_carts BOOLEAN NOT NULL DEFAULT true,
  monitor_new_customers BOOLEAN NOT NULL DEFAULT true,
  send_whatsapp BOOLEAN NOT NULL DEFAULT true,
  whatsapp_target TEXT,
  send_push BOOLEAN NOT NULL DEFAULT false,
  ai_tone TEXT NOT NULL DEFAULT 'coach' CHECK (ai_tone IN ('coach','direto','descontraido','executivo')),
  ai_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  max_insights_per_run SMALLINT NOT NULL DEFAULT 5,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_error TEXT,
  last_run_count INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_insight_settings TO authenticated;
GRANT ALL ON public.daily_insight_settings TO service_role;

ALTER TABLE public.daily_insight_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_insight_settings_admin_manager_read"
  ON public.daily_insight_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "daily_insight_settings_admin_write"
  ON public.daily_insight_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.daily_insight_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Feed of generated insights
CREATE TABLE public.daily_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,          -- revenue_drop | category_drop | product_drop | product_rise | rating_drop | cart_abandon | new_customers | opportunity | generic
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  finding TEXT NOT NULL,         -- what happened (fact)
  hypothesis TEXT,               -- why the AI thinks it happened
  suggested_action TEXT,         -- concrete next step
  action_kind TEXT,              -- coupon | push | popup | product | none
  action_payload JSONB,          -- prefilled data for one-click apply
  metrics JSONB,                 -- raw numbers used to build the insight
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','done','dismissed','snoozed')),
  triggered_by TEXT NOT NULL DEFAULT 'cron',  -- cron | manual
  delivered_whatsapp BOOLEAN NOT NULL DEFAULT false,
  delivered_push BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ
);

CREATE INDEX daily_insights_status_idx ON public.daily_insights (status, created_at DESC);
CREATE INDEX daily_insights_created_idx ON public.daily_insights (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_insights TO authenticated;
GRANT ALL ON public.daily_insights TO service_role;

ALTER TABLE public.daily_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_insights_admin_manager_read"
  ON public.daily_insights FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "daily_insights_admin_manager_update"
  ON public.daily_insights FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "daily_insights_admin_delete"
  ON public.daily_insights FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
