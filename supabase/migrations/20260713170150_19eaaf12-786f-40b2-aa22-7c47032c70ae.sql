
-- 1) Revoke anon EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.apply_pending_role_grants() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_tracking_token() FROM PUBLIC, anon;

-- 2) Remove anon SELECT policy on courier_locations (leaks live GPS)
DROP POLICY IF EXISTS "Public reads locations by order" ON public.courier_locations;

-- 3) Remove from realtime publication to stop unscoped broadcasts
ALTER PUBLICATION supabase_realtime DROP TABLE public.courier_locations;
