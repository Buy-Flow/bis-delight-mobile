
-- Recreate view as security_invoker so it enforces the caller's permissions
DROP VIEW IF EXISTS public.storefront_settings;

CREATE VIEW public.storefront_settings
WITH (security_invoker = true) AS
SELECT
  id, name, tagline, city, address, hours, hours_json,
  whatsapp, whatsapp_display, maps_url, map_embed, delivery_fee,
  logo_url, texture_url, instagram, facebook, tiktok,
  announcement_text, announcement_active, pix_key, payment_methods,
  free_delivery_threshold, min_order, accepts_delivery, accepts_pickup,
  open_override, updated_at
FROM public.site_settings
WHERE id = 1;

GRANT SELECT ON public.storefront_settings TO anon, authenticated;

-- Allow anonymous SELECT on site_settings BUT only on the columns the
-- storefront needs. Column-level GRANTs prevent direct queries from
-- reaching admin-only fields even if RLS lets the row through.
DROP POLICY IF EXISTS "admins read settings" ON public.site_settings;

CREATE POLICY "public read settings row" ON public.site_settings
  FOR SELECT TO anon, authenticated
  USING (id = 1);

REVOKE SELECT ON public.site_settings FROM anon, authenticated;

GRANT SELECT (
  id, name, tagline, city, address, hours, hours_json,
  whatsapp, whatsapp_display, maps_url, map_embed, delivery_fee,
  logo_url, texture_url, instagram, facebook, tiktok,
  announcement_text, announcement_active, pix_key, payment_methods,
  free_delivery_threshold, min_order, accepts_delivery, accepts_pickup,
  open_override, updated_at
) ON public.site_settings TO anon, authenticated;
