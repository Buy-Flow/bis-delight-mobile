
-- Settings singleton
CREATE TABLE IF NOT EXISTS public.prep_forecast_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  horizon_hours integer NOT NULL DEFAULT 3 CHECK (horizon_hours BETWEEN 1 AND 6),
  history_days integer NOT NULL DEFAULT 60 CHECK (history_days BETWEEN 14 AND 180),
  safety_stock_pct integer NOT NULL DEFAULT 20 CHECK (safety_stock_pct BETWEEN 0 AND 100),
  min_confidence_pct integer NOT NULL DEFAULT 40 CHECK (min_confidence_pct BETWEEN 0 AND 100),
  weather_boost_pct integer NOT NULL DEFAULT 15,
  weekend_boost_pct integer NOT NULL DEFAULT 10,
  round_up boolean NOT NULL DEFAULT true,
  include_paused boolean NOT NULL DEFAULT false,
  auto_notify boolean NOT NULL DEFAULT false,
  notify_channels text[] NOT NULL DEFAULT ARRAY['dashboard']::text[],
  auto_refresh_minutes integer NOT NULL DEFAULT 30 CHECK (auto_refresh_minutes BETWEEN 0 AND 240),
  ai_model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  ai_temperature numeric NOT NULL DEFAULT 0.3,
  min_batch_hint integer NOT NULL DEFAULT 0,
  waste_target_pct integer NOT NULL DEFAULT 5,
  categories_included text[] NOT NULL DEFAULT ARRAY[]::text[],
  categories_excluded text[] NOT NULL DEFAULT ARRAY[]::text[],
  ai_context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prep_forecast_settings_singleton CHECK (id = 1)
);
INSERT INTO public.prep_forecast_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prep_forecast_settings TO authenticated;
GRANT ALL ON public.prep_forecast_settings TO service_role;
ALTER TABLE public.prep_forecast_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/managers manage prep forecast settings"
ON public.prep_forecast_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff can read prep forecast settings"
ON public.prep_forecast_settings FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'kitchen')
);

-- Per-product prep fields
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS prep_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prep_yield_per_batch integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS prep_time_min integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS shelf_life_min integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS min_batches integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_batches integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS prep_priority integer NOT NULL DEFAULT 3;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_prep_forecast_settings_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS prep_forecast_settings_touch ON public.prep_forecast_settings;
CREATE TRIGGER prep_forecast_settings_touch
BEFORE UPDATE ON public.prep_forecast_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_prep_forecast_settings_touch();
