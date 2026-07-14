
CREATE TABLE IF NOT EXISTS public.print_printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kinds text[] NOT NULL DEFAULT ARRAY['cliente','cozinha','entrega']::text[],
  target text NOT NULL DEFAULT 'browser', -- browser | bridge | escpos
  bridge_url text,
  copies smallint NOT NULL DEFAULT 1,
  paper_width smallint,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_index smallint NOT NULL DEFAULT 0,
  last_ok_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT print_printers_target_check CHECK (target IN ('browser','bridge','escpos')),
  CONSTRAINT print_printers_copies_check CHECK (copies BETWEEN 1 AND 9),
  CONSTRAINT print_printers_paper_check CHECK (paper_width IS NULL OR paper_width IN (58,80))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_printers TO authenticated;
GRANT ALL ON public.print_printers TO service_role;

ALTER TABLE public.print_printers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_printers admin all" ON public.print_printers;
CREATE POLICY "print_printers admin all" ON public.print_printers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS print_printers_updated ON public.print_printers;
CREATE TRIGGER print_printers_updated
  BEFORE UPDATE ON public.print_printers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extra settings for automation
ALTER TABLE public.print_settings
  ADD COLUMN IF NOT EXISTS silent_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_delay_ms integer NOT NULL DEFAULT 800,
  ADD COLUMN IF NOT EXISTS max_retries smallint NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS beep_volume smallint NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS beep_repeat smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS only_paid_orders boolean NOT NULL DEFAULT false;

ALTER TABLE public.print_settings
  DROP CONSTRAINT IF EXISTS print_settings_auto_delay_check;
ALTER TABLE public.print_settings
  ADD CONSTRAINT print_settings_auto_delay_check CHECK (auto_delay_ms BETWEEN 0 AND 30000);

-- Extend print_jobs to record printer + payload + retries
ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS printer_id uuid REFERENCES public.print_printers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retries smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payload jsonb;

CREATE INDEX IF NOT EXISTS print_jobs_printer_idx ON public.print_jobs(printer_id);

-- Seed a default browser printer if none exists
INSERT INTO public.print_printers (name, kinds, target, is_default, sort_index)
SELECT 'Impressora padrão (navegador)', ARRAY['cliente','cozinha','entrega']::text[], 'browser', true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.print_printers);
