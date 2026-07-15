
REVOKE EXECUTE ON FUNCTION public.apply_inventory_movement() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_table_on_paid() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_review_helpful_count() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_order_item_price() FROM anon, authenticated, PUBLIC;
