ALTER TABLE public.push_campaigns ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE INDEX IF NOT EXISTS push_campaigns_expires_at_idx ON public.push_campaigns(expires_at);