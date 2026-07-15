
CREATE TABLE public.floor_plan_walls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  x1 numeric NOT NULL,
  y1 numeric NOT NULL,
  x2 numeric NOT NULL,
  y2 numeric NOT NULL,
  thickness numeric NOT NULL DEFAULT 6,
  color text NOT NULL DEFAULT '#ffffff',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.floor_plan_walls TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.floor_plan_walls TO authenticated;
GRANT ALL ON public.floor_plan_walls TO service_role;

ALTER TABLE public.floor_plan_walls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "walls readable" ON public.floor_plan_walls
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "walls admin write" ON public.floor_plan_walls
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
