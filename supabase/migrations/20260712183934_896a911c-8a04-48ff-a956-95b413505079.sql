
DROP VIEW IF EXISTS public.site_settings_public;
CREATE VIEW public.site_settings_public
WITH (security_invoker = true) AS
SELECT
  id, name, tagline, city, address, hours, whatsapp, whatsapp_display,
  maps_url, map_embed, delivery_fee, logo_url, texture_url, updated_at,
  instagram, facebook, tiktok, announcement_text, announcement_active,
  payment_methods, free_delivery_threshold, min_order,
  accepts_delivery, accepts_pickup, open_override, hours_json,
  news_active, news_title, news_product_ids, news_subtitle, news_ticker,
  global_extras, bg_color, accent_color, texture_opacity, texture_size,
  card_radius, card_border, card_glow, title_font, hero_images,
  popup_active, popup_title, popup_body, popup_image_url, popup_link,
  popup_cta, popup_image_pos_x, popup_image_pos_y, popup_image_scale, popup_frequency,
  urgency_active, urgency_text, urgency_ends_at, urgency_coupon_code,
  store_lat, store_lng, delivery_zone_json,
  pricing_card_fee_pct, pricing_tax_pct, pricing_platform_fee_pct,
  pricing_fixed_cost_monthly, pricing_expected_sales_monthly
FROM public.site_settings
WHERE id = 1;

GRANT SELECT ON public.site_settings_public TO anon, authenticated;

-- Recreate the public read policy on site_settings BUT restricted to non-sensitive access.
-- With security_invoker=true, the view executes as the querying user, so the base table needs
-- a SELECT policy for anon/authenticated. We add it back — pix_key protection is enforced by
-- column-level GRANT below.
CREATE POLICY "public read settings row"
  ON public.site_settings FOR SELECT
  TO anon, authenticated
  USING (id = 1);

-- Column-level restriction: only admins should ever see pix_key.
-- Revoke SELECT/UPDATE/INSERT on pix_key from anon and authenticated.
REVOKE SELECT (pix_key), INSERT (pix_key), UPDATE (pix_key)
  ON public.site_settings FROM anon, authenticated, PUBLIC;

-- Admin RPCs to read/write pix_key
CREATE OR REPLACE FUNCTION public.get_pix_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((SELECT pix_key FROM public.site_settings WHERE id = 1), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_pix_key(_val text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.site_settings SET pix_key = COALESCE(_val, '') WHERE id = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_pix_key() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_pix_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pix_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pix_key(text) TO authenticated;
