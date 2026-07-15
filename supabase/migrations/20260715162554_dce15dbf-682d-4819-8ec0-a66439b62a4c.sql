
ALTER TABLE public.loyalty_tiers
  ADD COLUMN IF NOT EXISTS icon_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS perks text,
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#facc15';
