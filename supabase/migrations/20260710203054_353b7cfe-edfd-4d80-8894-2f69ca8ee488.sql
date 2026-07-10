
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_loyalty_stamp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_new_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_loyalty_coupon(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_loyalty_coupon(text) TO authenticated;

REVOKE ALL ON FUNCTION public.redeem_loyalty_coupon(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_coupon(text) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_promo_coupon(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_promo_coupon(text, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.redeem_promo_coupon(text, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_promo_coupon(text, numeric, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_push_opened(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_push_opened(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_push_campaigns(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_push_campaigns(integer) TO authenticated;
