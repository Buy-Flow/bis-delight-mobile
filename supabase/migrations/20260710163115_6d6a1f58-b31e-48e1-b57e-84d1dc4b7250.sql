-- 1) Extend push_campaigns for scheduling
ALTER TABLE public.push_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- backfill existing rows
UPDATE public.push_campaigns SET sent_at = created_at WHERE sent_at IS NULL AND status = 'sent';

CREATE INDEX IF NOT EXISTS push_campaigns_scheduled_idx
  ON public.push_campaigns (status, scheduled_for)
  WHERE status = 'scheduled';

-- 2) push_automations: reusable rules
CREATE TABLE IF NOT EXISTS public.push_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('birthday','dormant','welcome')),
  title text NOT NULL,
  body text NOT NULL,
  url text,
  image text,
  active boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_automations TO authenticated;
GRANT ALL ON public.push_automations TO service_role;
ALTER TABLE public.push_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage automations"
  ON public.push_automations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER push_automations_updated_at
  BEFORE UPDATE ON public.push_automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) automation_runs: idempotency per user per automation per day
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.push_automations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  run_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, user_id, run_key)
);

GRANT SELECT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read automation runs"
  ON public.automation_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 4) Seed default automations (inactive)
INSERT INTO public.push_automations (kind, title, body, url, active, config) VALUES
  ('birthday','🎂 Feliz aniversário, {{primeiro_nome}}!','Hoje o mimo é por nossa conta. Passa aqui e aproveita 🎉','/', false,'{}'::jsonb),
  ('dormant','A gente sentiu sua falta, {{primeiro_nome}} 💜','Faz tempo que você não pede… que tal um docinho pra hoje?','/', false, jsonb_build_object('days',60)),
  ('welcome','Obrigado pelo primeiro pedido, {{primeiro_nome}}! 🍧','Volta sempre — cada 10 pedidinhos rende um brinde 🎁','/recompensas', false,'{}'::jsonb)
ON CONFLICT (kind) DO NOTHING;