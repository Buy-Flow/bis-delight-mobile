
-- ============================================================
-- Fix 1: Move has_role to a private (non-exposed) schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate app-schema policies against the new function
DROP POLICY IF EXISTS "admins manage categories" ON public.categories;
CREATE POLICY "admins manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins manage products" ON public.products;
CREATE POLICY "admins manage products" ON public.products
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all products" ON public.products;
CREATE POLICY "admins read all products" ON public.products
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins manage settings" ON public.site_settings;
CREATE POLICY "admins manage settings" ON public.site_settings
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Recreate storage policies against the new function
DROP POLICY IF EXISTS "admins upload product-images" ON storage.objects;
DROP POLICY IF EXISTS "admins update product-images" ON storage.objects;
DROP POLICY IF EXISTS "admins delete product-images" ON storage.objects;

CREATE POLICY "admins upload product-images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins update product-images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins delete product-images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));

-- Finally drop the exposed copy
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- ============================================================
-- Fix 2: Stop exposing raw site_settings publicly; use a view
-- ============================================================
DROP POLICY IF EXISTS "public read settings" ON public.site_settings;

CREATE POLICY "admins read settings" ON public.site_settings
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.storefront_settings
WITH (security_invoker = false) AS
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
