-- Hide internal cost/margin fields from public menu reads while keeping
-- admin/staff and server-side access via service_role intact.
REVOKE SELECT (cost_price, packaging_cost, target_margin_pct) ON public.products FROM anon;
REVOKE SELECT (cost_price, packaging_cost, target_margin_pct) ON public.products FROM authenticated;
REVOKE SELECT (stock, low_stock_threshold) ON public.products FROM anon;

GRANT SELECT (cost_price, packaging_cost, target_margin_pct, stock, low_stock_threshold)
  ON public.products TO service_role;