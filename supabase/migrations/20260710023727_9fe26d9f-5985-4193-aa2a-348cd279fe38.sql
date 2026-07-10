CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DROP TRIGGER IF EXISTS trg_notify_admin_new_order ON public.orders;
CREATE TRIGGER trg_notify_admin_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_new_order();

DROP POLICY IF EXISTS "user manages own subscription" ON public.push_subscriptions;
CREATE POLICY "user manages own subscription"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING ((user_id IS NULL) OR (user_id = auth.uid()))
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin writes deliveries" ON public.push_deliveries;
CREATE POLICY "admin writes deliveries"
ON public.push_deliveries
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_deliveries TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT ALL ON public.push_deliveries TO service_role;