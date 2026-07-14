
REVOKE EXECUTE ON FUNCTION public.enforce_order_item_pricing() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_order_totals()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_order_financials()     FROM PUBLIC, anon, authenticated;
