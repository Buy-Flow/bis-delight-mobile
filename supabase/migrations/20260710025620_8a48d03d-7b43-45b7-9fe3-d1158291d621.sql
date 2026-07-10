DROP POLICY IF EXISTS "insert own subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "user deletes own subscription" ON public.push_subscriptions;

CREATE POLICY "insert own subscription" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user deletes own subscription" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());