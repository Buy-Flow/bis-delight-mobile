ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS pause_reason text;
CREATE INDEX IF NOT EXISTS products_paused_until_idx ON public.products (paused_until) WHERE paused_until IS NOT NULL;