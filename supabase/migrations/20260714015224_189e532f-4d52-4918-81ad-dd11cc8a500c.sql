
CREATE TABLE IF NOT EXISTS public.competitor_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  region TEXT,
  notes TEXT,
  photo_paths TEXT[] NOT NULL DEFAULT '{}',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  ai_model TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_analyses TO authenticated;
GRANT ALL ON public.competitor_analyses TO service_role;

ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view competitor analyses" ON public.competitor_analyses
FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert competitor analyses" ON public.competitor_analyses
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND created_by = auth.uid());
CREATE POLICY "Admins update competitor analyses" ON public.competitor_analyses
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete competitor analyses" ON public.competitor_analyses
FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_competitor_analyses_created_at ON public.competitor_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_analyses_competitor ON public.competitor_analyses(competitor_name);

CREATE TRIGGER trg_competitor_analyses_updated
BEFORE UPDATE ON public.competitor_analyses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
