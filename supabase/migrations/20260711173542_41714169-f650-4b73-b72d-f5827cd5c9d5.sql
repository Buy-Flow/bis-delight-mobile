-- Config table for loyalty tiers (admin-editable)
CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
  tier text PRIMARY KEY,
  sort_order int NOT NULL,
  label text NOT NULL,
  min_lifetime int NOT NULL DEFAULT 0,
  stamps_per_order int NOT NULL DEFAULT 1,
  min_order_value numeric NOT NULL DEFAULT 0,
  coupon_value numeric NOT NULL DEFAULT 10,
  redeem_cost int NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_tiers TO anon, authenticated;
GRANT ALL ON public.loyalty_tiers TO service_role;

ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_tiers readable by all"
  ON public.loyalty_tiers FOR SELECT
  USING (true);

CREATE POLICY "loyalty_tiers admin write"
  ON public.loyalty_tiers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed initial values (Prata now = 1 stamp / R$10)
INSERT INTO public.loyalty_tiers (tier, sort_order, label, min_lifetime, stamps_per_order, min_order_value, coupon_value, redeem_cost) VALUES
  ('bronze', 1, 'Bronze', 0,   1, 20, 10, 10),
  ('prata',  2, 'Prata',  20,  1, 10, 10, 10),
  ('ouro',   3, 'Ouro',   100, 3, 10, 20, 10)
ON CONFLICT (tier) DO UPDATE
  SET stamps_per_order = EXCLUDED.stamps_per_order,
      min_order_value = EXCLUDED.min_order_value,
      coupon_value = EXCLUDED.coupon_value,
      min_lifetime = EXCLUDED.min_lifetime,
      label = EXCLUDED.label,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();

-- Rewrite the tier helper functions to read from the config table
CREATE OR REPLACE FUNCTION public.loyalty_tier(_lifetime int)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tier FROM public.loyalty_tiers
   WHERE _lifetime >= min_lifetime
   ORDER BY min_lifetime DESC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_reward_value(_tier text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coupon_value FROM public.loyalty_tiers WHERE tier = _tier;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_min_order(_tier text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT min_order_value FROM public.loyalty_tiers WHERE tier = _tier;
$$;

-- stamps_per_order stored directly; keep the bonus helper for compatibility (bonus = stamps_per_order - 1)
CREATE OR REPLACE FUNCTION public.loyalty_stamp_bonus(_tier text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(stamps_per_order - 1, 0) FROM public.loyalty_tiers WHERE tier = _tier;
$$;

REVOKE EXECUTE ON FUNCTION public.loyalty_tier(int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.loyalty_reward_value(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.loyalty_min_order(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.loyalty_stamp_bonus(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_tier(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_reward_value(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_min_order(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_stamp_bonus(text) TO authenticated, service_role;