
CREATE TABLE IF NOT EXISTS public.pwa_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled BOOLEAN NOT NULL DEFAULT true,
  kill_switch BOOLEAN NOT NULL DEFAULT false,
  cache_version INTEGER NOT NULL DEFAULT 1,
  offline_banner_enabled BOOLEAN NOT NULL DEFAULT true,
  offline_banner_text TEXT NOT NULL DEFAULT 'Você está offline — mostrando o cardápio salvo.',
  online_restored_text TEXT NOT NULL DEFAULT 'Conexão restaurada.',
  offline_fallback_title TEXT NOT NULL DEFAULT 'Sem conexão',
  offline_fallback_message TEXT NOT NULL DEFAULT 'Não conseguimos carregar essa página agora, mas o cardápio salvo continua disponível.',
  offline_fallback_cta TEXT NOT NULL DEFAULT 'Ver cardápio salvo',
  prefetch_menu_on_load BOOLEAN NOT NULL DEFAULT true,
  prefetch_images BOOLEAN NOT NULL DEFAULT true,
  max_image_cache_entries INTEGER NOT NULL DEFAULT 200 CHECK (max_image_cache_entries BETWEEN 20 AND 2000),
  auto_update BOOLEAN NOT NULL DEFAULT true,
  show_install_prompt BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.pwa_settings TO anon, authenticated;
GRANT UPDATE, INSERT ON public.pwa_settings TO authenticated;
GRANT ALL ON public.pwa_settings TO service_role;

ALTER TABLE public.pwa_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pwa_settings_read_all" ON public.pwa_settings;
CREATE POLICY "pwa_settings_read_all" ON public.pwa_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "pwa_settings_admin_write" ON public.pwa_settings;
CREATE POLICY "pwa_settings_admin_write" ON public.pwa_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.pwa_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.pwa_settings_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pwa_settings_touch_tr ON public.pwa_settings;
CREATE TRIGGER pwa_settings_touch_tr BEFORE UPDATE ON public.pwa_settings
FOR EACH ROW EXECUTE FUNCTION public.pwa_settings_touch();
