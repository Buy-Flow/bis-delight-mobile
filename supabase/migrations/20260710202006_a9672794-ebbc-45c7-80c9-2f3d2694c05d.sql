DROP POLICY IF EXISTS "user reads campaigns of own deliveries" ON public.push_campaigns;

CREATE OR REPLACE VIEW public.push_campaigns_public
WITH (security_invoker=off) AS
SELECT c.id, c.title, c.body, c.image, c.url, c.created_at, c.expires_at
FROM public.push_campaigns c
WHERE EXISTS (
  SELECT 1
  FROM public.push_deliveries d
  JOIN public.push_subscriptions s ON s.id = d.subscription_id
  WHERE d.campaign_id = c.id AND s.user_id = auth.uid()
);

GRANT SELECT ON public.push_campaigns_public TO authenticated;