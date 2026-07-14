
-- Revoke public/anon/authenticated EXECUTE from trigger + internal helper SECURITY DEFINER functions.
-- Triggers run as the function owner so this does not affect DB internals.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_courier_self_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_referrer_on_paid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_new_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_pending_role_grants() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrement_stock_on_paid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ingredients_on_paid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stamp_order_status_times() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_loyalty_stamp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_order_totals() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_addresses_enforce_single_default() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_order_item_pricing() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_order_financials() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_order_courier_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reviews_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reviews_stamp_reply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_opt_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_tier(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_reward_value(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_stamp_bonus(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_min_order(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_birthday_push_sent(uuid) FROM PUBLIC, anon, authenticated;

-- Revoke anon from user-authenticated RPCs (auth.uid() is null for anon anyway).
REVOKE EXECUTE ON FUNCTION public.get_winback_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_promo_coupon(text, numeric, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_role(uuid, app_role, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_pending_grant(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_pending_grants() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_birthday_gift_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_role_audit(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_birthday_settings(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_push_opened(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_loyalty_coupon(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_push_campaigns(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_loyalty_coupon(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_referral_settings(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_shared_cart(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_shared_cart(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_loyalty_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_referrals() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_referrals(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_referral_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_birthday_settings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_send_birthday_gift(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_birthday_gift() FROM anon;
