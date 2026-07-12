
-- 1) Restrict couriers SELECT to admins
DROP POLICY IF EXISTS "Authenticated can read couriers" ON public.couriers;
CREATE POLICY "Admins read couriers"
  ON public.couriers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Restrict waiters SELECT to admins
DROP POLICY IF EXISTS "waiters read authenticated" ON public.waiters;
CREATE POLICY "Admins read waiters"
  ON public.waiters FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) site_settings pix_key: remove public read policy on base table; expose safe columns via view
DROP POLICY IF EXISTS "public read settings row" ON public.site_settings;

-- Ensure admins can SELECT via existing "admins manage settings" FOR ALL (already covers SELECT).
-- Create/refresh public view without pix_key
DROP VIEW IF EXISTS public.site_settings_public;
CREATE VIEW public.site_settings_public AS
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

-- 4) Revoke anon EXECUTE on admin-only table management functions (they self-check has_role, but shouldn't be callable by unauthenticated users at all)
REVOKE EXECUTE ON FUNCTION public.clear_table(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.open_table(uuid, integer, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.transfer_table(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_table(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_table(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_table(uuid, uuid) TO authenticated;
