
-- 1) Set immutable search_path on the remaining helper functions
ALTER FUNCTION public.loyalty_tier(integer) SET search_path = public;
ALTER FUNCTION public.loyalty_reward_value(text) SET search_path = public;
ALTER FUNCTION public.loyalty_stamp_bonus(text) SET search_path = public;
ALTER FUNCTION public.loyalty_min_order(text) SET search_path = public;

-- 2) Lock down SECURITY DEFINER functions: revoke public/anon EXECUTE,
--    grant only to the roles that actually need to call them.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid,
           n.nspname,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;',
                   r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role;',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- has_role is referenced in RLS policies that may evaluate for anon queries
-- against public tables; keep it executable by anon so policies do not error.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;

-- 3) Fix push_subscriptions UPDATE policy: only allow updates on rows the
--    user already owns. Anonymous-to-authenticated linking should go through
--    a server-side controlled path, not client UPDATEs on user_id IS NULL rows.
DROP POLICY IF EXISTS "user manages own subscription" ON public.push_subscriptions;
CREATE POLICY "user manages own subscription"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
