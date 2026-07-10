DROP VIEW IF EXISTS public.push_campaigns_public;

CREATE VIEW public.push_campaigns_public
WITH (security_invoker=on) AS
SELECT c.id, c.title, c.body, c.image, c.url, c.created_at, c.expires_at
FROM public.push_campaigns c;

GRANT SELECT ON public.push_campaigns_public TO authenticated;

CREATE POLICY "user reads own delivery campaigns"
ON public.push_campaigns
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.push_deliveries d
    JOIN public.push_subscriptions s ON s.id = d.subscription_id
    WHERE d.campaign_id = push_campaigns.id AND s.user_id = auth.uid()
  )
);

REVOKE SELECT ON public.push_campaigns FROM authenticated;
GRANT SELECT (
  id, title, body, url, image, audience, created_by,
  created_at, expires_at, scheduled_for, status, sent_at
) ON public.push_campaigns TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.push_campaigns TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_push_campaigns(_limit int DEFAULT 40)
RETURNS SETOF public.push_campaigns
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT * FROM public.push_campaigns
    ORDER BY created_at DESC
    LIMIT _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_push_campaigns(int) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_push_campaigns(int) TO authenticated;