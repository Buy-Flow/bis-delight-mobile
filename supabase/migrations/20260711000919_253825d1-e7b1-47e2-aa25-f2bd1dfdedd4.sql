
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS store_lat numeric,
  ADD COLUMN IF NOT EXISTS store_lng numeric,
  ADD COLUMN IF NOT EXISTS delivery_zone_json jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS distance_km numeric,
  ADD COLUMN IF NOT EXISTS delivery_lat numeric,
  ADD COLUMN IF NOT EXISTS delivery_lng numeric;
