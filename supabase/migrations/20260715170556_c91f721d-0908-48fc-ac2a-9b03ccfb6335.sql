REVOKE ALL ON FUNCTION public.auto_cancel_expired_pending_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_cancel_expired_pending_orders() TO service_role, postgres;