
-- 1) Lock down SECURITY DEFINER functions in public schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- Re-grant EXECUTE to authenticated for RPCs the app calls
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_coupon(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_loyalty_coupon(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_coupon(text, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_promo_coupon(text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_birthday_gift() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_birthday_gift_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_loyalty_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_push_opened(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_push_campaigns(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_tier(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_reward_value(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_stamp_bonus(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_min_order(text) TO authenticated;

-- 2) Categories: restrict public read to active rows; add admin-read policy
DROP POLICY IF EXISTS "public read categories" ON public.categories;

CREATE POLICY "public read active categories"
ON public.categories
FOR SELECT
TO public
USING (active = true);

CREATE POLICY "admins read all categories"
ON public.categories
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));
