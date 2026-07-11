
CREATE TABLE public.waiters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  phone text,
  avatar_url text,
  commission_pct numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  hired_at date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.waiters TO authenticated;
GRANT ALL ON public.waiters TO service_role;

ALTER TABLE public.waiters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waiters read authenticated" ON public.waiters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "waiters admin write" ON public.waiters
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER waiters_set_updated_at
  BEFORE UPDATE ON public.waiters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_waiter_id_idx ON public.orders(waiter_id);
