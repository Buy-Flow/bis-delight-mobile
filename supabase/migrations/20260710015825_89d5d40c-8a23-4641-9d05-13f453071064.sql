
-- Push subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can register a subscription (anonymous devices allowed)
CREATE POLICY "insert own subscription"
  ON public.push_subscriptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "user manages own subscription"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "user deletes own subscription"
  ON public.push_subscriptions FOR DELETE
  TO anon, authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "admin reads all subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user reads own subscription"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Push campaigns
CREATE TABLE public.push_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  image TEXT,
  audience TEXT NOT NULL DEFAULT 'all',
  sent_count INT NOT NULL DEFAULT 0,
  opened_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_campaigns TO authenticated;
GRANT ALL ON public.push_campaigns TO service_role;
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages campaigns"
  ON public.push_campaigns FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Push deliveries
CREATE TABLE public.push_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.push_campaigns(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_deliveries_campaign ON public.push_deliveries(campaign_id);

GRANT SELECT, INSERT, UPDATE ON public.push_deliveries TO authenticated;
GRANT UPDATE ON public.push_deliveries TO anon;
GRANT ALL ON public.push_deliveries TO service_role;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin reads deliveries"
  ON public.push_deliveries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RPC to mark opened (public, only sets opened_at)
CREATE OR REPLACE FUNCTION public.mark_push_opened(_delivery_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.push_deliveries SET opened_at = now() WHERE id = _delivery_id AND opened_at IS NULL;
  UPDATE public.push_campaigns c
     SET opened_count = opened_count + 1
   WHERE c.id = (SELECT campaign_id FROM public.push_deliveries WHERE id = _delivery_id)
     AND (SELECT opened_at FROM public.push_deliveries WHERE id = _delivery_id) = now();
$$;

GRANT EXECUTE ON FUNCTION public.mark_push_opened(UUID) TO anon, authenticated;
