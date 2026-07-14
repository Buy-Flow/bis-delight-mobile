CREATE TABLE IF NOT EXISTS public.skeleton_settings (
  id text PRIMARY KEY DEFAULT 'default',
  enabled boolean NOT NULL DEFAULT true,
  variant text NOT NULL DEFAULT 'shimmer',
  speed_ms integer NOT NULL DEFAULT 1600,
  radius_px integer NOT NULL DEFAULT 14,
  tone text NOT NULL DEFAULT 'auto',
  intensity numeric NOT NULL DEFAULT 0.08,
  tint text NOT NULL DEFAULT 'neutral',
  stagger_ms integer NOT NULL DEFAULT 60,
  on_menu boolean NOT NULL DEFAULT true,
  on_orders boolean NOT NULL DEFAULT true,
  on_admin boolean NOT NULL DEFAULT true,
  on_lists boolean NOT NULL DEFAULT true,
  on_forms boolean NOT NULL DEFAULT true,
  reduce_motion_respect boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skeleton_settings_singleton CHECK (id = 'default'),
  CONSTRAINT skeleton_settings_variant_chk CHECK (variant IN ('shimmer','pulse','wave','static')),
  CONSTRAINT skeleton_settings_tone_chk CHECK (tone IN ('auto','light','dark','brand')),
  CONSTRAINT skeleton_settings_tint_chk CHECK (tint IN ('neutral','brand','warm','cool'))
);

GRANT SELECT ON public.skeleton_settings TO anon, authenticated;
GRANT ALL ON public.skeleton_settings TO service_role;

ALTER TABLE public.skeleton_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skeleton read all" ON public.skeleton_settings;
CREATE POLICY "skeleton read all" ON public.skeleton_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "skeleton admin write" ON public.skeleton_settings;
CREATE POLICY "skeleton admin write" ON public.skeleton_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.skeleton_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.touch_skeleton_settings() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS skeleton_settings_touch ON public.skeleton_settings;
CREATE TRIGGER skeleton_settings_touch BEFORE UPDATE ON public.skeleton_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_skeleton_settings();