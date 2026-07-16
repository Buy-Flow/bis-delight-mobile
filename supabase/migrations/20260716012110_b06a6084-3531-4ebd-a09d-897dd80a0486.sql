
-- 1) Extend guard_order_financials to BEFORE INSERT for non-staff (clamp discount/fees to 0)
CREATE OR REPLACE FUNCTION public.guard_order_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_staff boolean := false;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN ('admin','manager','cashier','waiter','staff')
  ) INTO v_is_staff;

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Customers cannot fabricate discounts or zero out fees on insert.
    NEW.coupon_discount := 0;
    NEW.coupon_code     := NULL;
    NEW.service_fee     := COALESCE(NEW.service_fee, 0);
    IF NEW.service_fee < 0 THEN NEW.service_fee := 0; END IF;
    IF NEW.delivery_fee IS NULL OR NEW.delivery_fee < 0 THEN
      NEW.delivery_fee := 0;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.subtotal        IS DISTINCT FROM OLD.subtotal        THEN NEW.subtotal        := OLD.subtotal;        END IF;
  IF NEW.total           IS DISTINCT FROM OLD.total           THEN NEW.total           := OLD.total;           END IF;
  IF NEW.delivery_fee    IS DISTINCT FROM OLD.delivery_fee    THEN NEW.delivery_fee    := OLD.delivery_fee;    END IF;
  IF NEW.service_fee     IS DISTINCT FROM OLD.service_fee     THEN NEW.service_fee     := OLD.service_fee;     END IF;
  IF NEW.coupon_discount IS DISTINCT FROM OLD.coupon_discount THEN NEW.coupon_discount := OLD.coupon_discount; END IF;
  IF NEW.coupon_code     IS DISTINCT FROM OLD.coupon_code     THEN NEW.coupon_code     := OLD.coupon_code;     END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_order_financials_ins ON public.orders;
CREATE TRIGGER trg_guard_order_financials_ins
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_financials();

-- 2) product_templates: remove public SELECT policy; restrict to staff.
DROP POLICY IF EXISTS "Anyone can read templates" ON public.product_templates;
CREATE POLICY "Staff can read templates"
ON public.product_templates
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'manager')
  OR public.has_role(auth.uid(),'staff')
);

-- 3) site_settings: hide pricing_* columns from anon/authenticated via column privileges.
-- Public policy stays (id = 1), but Data API only returns columns the role has SELECT on.
REVOKE SELECT ON public.site_settings FROM anon, authenticated;

GRANT SELECT (
  id, name, tagline, city, address, hours, whatsapp, whatsapp_display,
  maps_url, map_embed, delivery_fee, logo_url, texture_url, updated_at,
  instagram, facebook, tiktok, announcement_text, announcement_active,
  pix_key, payment_methods, free_delivery_threshold, min_order,
  accepts_delivery, accepts_pickup, open_override, hours_json,
  news_active, news_title, news_product_ids, news_subtitle, news_ticker,
  global_extras, bg_color, accent_color, texture_opacity, texture_size,
  card_radius, card_border, card_glow, title_font, hero_images,
  popup_active, popup_title, popup_body, popup_image_url, popup_link,
  popup_cta, popup_image_pos_x, popup_image_pos_y, popup_image_scale,
  popup_frequency, urgency_active, urgency_text, urgency_ends_at,
  urgency_coupon_code, store_lat, store_lng, delivery_zone_json
) ON public.site_settings TO anon, authenticated;

-- Admins keep full access via existing "admins manage settings" policy + service_role.
GRANT ALL ON public.site_settings TO service_role;
