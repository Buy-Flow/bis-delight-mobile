
ALTER TABLE public.asaas_webhook_events ADD COLUMN IF NOT EXISTS asaas_event_id text;
CREATE UNIQUE INDEX IF NOT EXISTS asaas_webhook_events_event_id_uidx ON public.asaas_webhook_events(asaas_event_id) WHERE asaas_event_id IS NOT NULL;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS asaas_customer_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS asaas_card_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS asaas_card_last4 text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS asaas_card_brand text;
