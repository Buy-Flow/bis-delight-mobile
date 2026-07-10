-- Revoke EXECUTE from anon/PUBLIC on all SECURITY DEFINER functions in public schema
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_loyalty_coupon(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_loyalty_coupon(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_promo_coupon(text, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_promo_coupon(text, numeric, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_push_opened(uuid) FROM PUBLIC, anon;

-- Trigger-only functions: no direct execution needed by any role
REVOKE EXECUTE ON FUNCTION public.grant_loyalty_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_new_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Ensure authenticated retains access on functions called from the app
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_loyalty_coupon(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_coupon(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_promo_coupon(text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_coupon(text, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_push_opened(uuid) TO authenticated;