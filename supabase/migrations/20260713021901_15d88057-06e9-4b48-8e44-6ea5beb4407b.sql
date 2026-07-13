
CREATE TABLE public.whatsapp_ingest_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'webhook',
  event text,
  status text NOT NULL,
  phone text,
  evolution_id text,
  from_me boolean,
  message_type text,
  preview text,
  error text,
  payload jsonb
);
CREATE INDEX whatsapp_ingest_logs_created_at_idx ON public.whatsapp_ingest_logs (created_at DESC);
CREATE INDEX whatsapp_ingest_logs_status_idx ON public.whatsapp_ingest_logs (status);
GRANT SELECT ON public.whatsapp_ingest_logs TO authenticated;
GRANT ALL ON public.whatsapp_ingest_logs TO service_role;
ALTER TABLE public.whatsapp_ingest_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read whatsapp ingest logs"
  ON public.whatsapp_ingest_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
