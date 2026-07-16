
-- restaurant_tables: permitir admin + manager + staff
DROP POLICY IF EXISTS "Admins manage tables" ON public.restaurant_tables;
CREATE POLICY "Staff manage tables" ON public.restaurant_tables
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  );

-- waiters: leitura para toda equipe, escrita para admin + manager
DROP POLICY IF EXISTS "Admins read waiters" ON public.waiters;
DROP POLICY IF EXISTS "waiters admin write" ON public.waiters;
CREATE POLICY "Staff read waiters" ON public.waiters
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  );
CREATE POLICY "Managers manage waiters" ON public.waiters
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

-- orders: manager e staff podem ler e atualizar pedidos operacionais
DROP POLICY IF EXISTS "admin read orders" ON public.orders;
DROP POLICY IF EXISTS "admin update orders" ON public.orders;
CREATE POLICY "staff read orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  );
CREATE POLICY "staff update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  );
