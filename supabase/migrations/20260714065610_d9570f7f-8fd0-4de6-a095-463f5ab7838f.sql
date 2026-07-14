-- Trigger-only guard functions must not be callable via the Data API. They run
-- as row triggers on couriers/orders and have no legitimate RPC caller.
REVOKE ALL ON FUNCTION public.guard_courier_self_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_order_courier_update() FROM PUBLIC, anon, authenticated;