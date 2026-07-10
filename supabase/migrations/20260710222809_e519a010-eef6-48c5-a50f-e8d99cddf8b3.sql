
CREATE TABLE public.site_popups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'Pop-up',
  active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  image_pos_x numeric NOT NULL DEFAULT 0,
  image_pos_y numeric NOT NULL DEFAULT 0,
  image_scale numeric NOT NULL DEFAULT 1,
  cta text NOT NULL DEFAULT 'Ver agora',
  link text NOT NULL DEFAULT '',
  frequency text NOT NULL DEFAULT 'session',
  days_of_week integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  start_hour integer,
  end_hour integer,
  starts_at timestamptz,
  ends_at timestamptz,
  audience text NOT NULL DEFAULT 'all',
  audience_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_popups TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_popups TO authenticated;
GRANT ALL ON public.site_popups TO service_role;

ALTER TABLE public.site_popups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active popups"
  ON public.site_popups FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can view all popups"
  ON public.site_popups FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert popups"
  ON public.site_popups FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update popups"
  ON public.site_popups FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete popups"
  ON public.site_popups FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_popups_updated_at
  BEFORE UPDATE ON public.site_popups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migra o pop-up global antigo (se estiver ativo) para a nova tabela
INSERT INTO public.site_popups (
  name, active, priority, title, body, image_url,
  image_pos_x, image_pos_y, image_scale, cta, link, frequency
)
SELECT
  COALESCE(NULLIF(popup_title, ''), 'Pop-up'),
  COALESCE(popup_active, false),
  0,
  COALESCE(popup_title, ''),
  COALESCE(popup_body, ''),
  COALESCE(popup_image_url, ''),
  COALESCE(popup_image_pos_x, 0),
  COALESCE(popup_image_pos_y, 0),
  COALESCE(popup_image_scale, 1),
  COALESCE(NULLIF(popup_cta, ''), 'Ver agora'),
  COALESCE(popup_link, ''),
  COALESCE(NULLIF(popup_frequency, ''), 'session')
FROM public.site_settings
WHERE popup_active = true
  AND (COALESCE(popup_title,'') <> '' OR COALESCE(popup_body,'') <> '' OR COALESCE(popup_image_url,'') <> '');
