
CREATE TABLE public.print_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  paper_width smallint NOT NULL DEFAULT 80,
  font_size smallint NOT NULL DEFAULT 12,
  header_text text NOT NULL DEFAULT '',
  footer_text text NOT NULL DEFAULT 'Obrigado pela preferência!',
  show_logo boolean NOT NULL DEFAULT true,
  show_qr boolean NOT NULL DEFAULT false,
  show_pix boolean NOT NULL DEFAULT false,
  show_cnpj boolean NOT NULL DEFAULT false,
  cnpj text NOT NULL DEFAULT '',
  tax_note text NOT NULL DEFAULT 'Este documento não possui valor fiscal',
  print_customer_copy boolean NOT NULL DEFAULT true,
  print_kitchen_copy boolean NOT NULL DEFAULT true,
  print_delivery_label boolean NOT NULL DEFAULT true,
  auto_print_new_orders boolean NOT NULL DEFAULT false,
  copies smallint NOT NULL DEFAULT 1,
  cut_after boolean NOT NULL DEFAULT true,
  beep_on_new boolean NOT NULL DEFAULT true,
  kitchen_group_by_category boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT print_settings_singleton CHECK (id = 1),
  CONSTRAINT print_settings_paper_width_valid CHECK (paper_width IN (58, 80))
);

GRANT SELECT ON public.print_settings TO authenticated;
GRANT ALL ON public.print_settings TO service_role;
ALTER TABLE public.print_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "print_settings read authenticated" ON public.print_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "print_settings admin write" ON public.print_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER print_settings_updated
  BEFORE UPDATE ON public.print_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.print_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  printed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT print_jobs_kind_check CHECK (kind IN ('cliente','cozinha','entrega','teste')),
  CONSTRAINT print_jobs_status_check CHECK (status IN ('ok','erro'))
);

GRANT SELECT, INSERT ON public.print_jobs TO authenticated;
GRANT ALL ON public.print_jobs TO service_role;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "print_jobs read authenticated" ON public.print_jobs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "print_jobs admin insert" ON public.print_jobs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX print_jobs_created_at_idx ON public.print_jobs (created_at DESC);
