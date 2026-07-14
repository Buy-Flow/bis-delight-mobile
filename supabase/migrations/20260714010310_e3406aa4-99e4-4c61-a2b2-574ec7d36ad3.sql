
-- =========================
-- route_optimization_settings (singleton)
-- =========================
CREATE TABLE IF NOT EXISTS public.route_optimization_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  min_stops INTEGER NOT NULL DEFAULT 2,
  max_stops INTEGER NOT NULL DEFAULT 8,
  provider TEXT NOT NULL DEFAULT 'google_directions',
  travel_mode TEXT NOT NULL DEFAULT 'TWO_WHEELER',
  traffic_mode TEXT NOT NULL DEFAULT 'TRAFFIC_AWARE',
  avoid_tolls BOOLEAN NOT NULL DEFAULT false,
  avoid_highways BOOLEAN NOT NULL DEFAULT false,
  avoid_ferries BOOLEAN NOT NULL DEFAULT true,
  return_to_store BOOLEAN NOT NULL DEFAULT true,
  auto_optimize BOOLEAN NOT NULL DEFAULT true,
  notify_courier BOOLEAN NOT NULL DEFAULT true,
  units TEXT NOT NULL DEFAULT 'METRIC',
  extra_time_per_stop_min INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT route_opt_singleton CHECK (id = 1),
  CONSTRAINT route_opt_provider_chk CHECK (provider IN ('google_directions','nearest_neighbor')),
  CONSTRAINT route_opt_travel_chk CHECK (travel_mode IN ('DRIVE','TWO_WHEELER','BICYCLE')),
  CONSTRAINT route_opt_traffic_chk CHECK (traffic_mode IN ('TRAFFIC_AWARE','TRAFFIC_AWARE_OPTIMAL','TRAFFIC_UNAWARE'))
);

GRANT SELECT ON public.route_optimization_settings TO authenticated;
GRANT ALL ON public.route_optimization_settings TO service_role;

ALTER TABLE public.route_optimization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "route_opt_read_authenticated" ON public.route_optimization_settings;
CREATE POLICY "route_opt_read_authenticated" ON public.route_optimization_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "route_opt_admin_write" ON public.route_optimization_settings;
CREATE POLICY "route_opt_admin_write" ON public.route_optimization_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed singleton row
INSERT INTO public.route_optimization_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.route_opt_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_route_opt_touch ON public.route_optimization_settings;
CREATE TRIGGER trg_route_opt_touch
BEFORE UPDATE ON public.route_optimization_settings
FOR EACH ROW EXECUTE FUNCTION public.route_opt_touch_updated_at();

-- =========================
-- route_optimizations (history)
-- =========================
CREATE TABLE IF NOT EXISTS public.route_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES public.couriers(id) ON DELETE SET NULL,
  order_ids UUID[] NOT NULL,
  sequence UUID[] NOT NULL,
  total_distance_km NUMERIC(10,2),
  total_duration_min NUMERIC(10,2),
  naive_distance_km NUMERIC(10,2),
  saved_km NUMERIC(10,2),
  saved_min NUMERIC(10,2),
  encoded_polyline TEXT,
  legs JSONB,
  origin_lat NUMERIC(10,7),
  origin_lng NUMERIC(10,7),
  provider_used TEXT,
  return_to_store BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_opt_courier_created
  ON public.route_optimizations(courier_id, created_at DESC);

GRANT SELECT ON public.route_optimizations TO authenticated;
GRANT ALL ON public.route_optimizations TO service_role;

ALTER TABLE public.route_optimizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "route_hist_admin_all" ON public.route_optimizations;
CREATE POLICY "route_hist_admin_all" ON public.route_optimizations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.couriers c
      WHERE c.id = route_optimizations.courier_id
        AND c.user_id = auth.uid()
    )
  );
