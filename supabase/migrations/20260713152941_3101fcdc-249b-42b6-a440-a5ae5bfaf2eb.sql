
CREATE TABLE public.pending_role_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  full_name TEXT,
  note TEXT,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  applied_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pending_role_grants_email_role_pending_uq
  ON public.pending_role_grants (lower(email), role)
  WHERE applied_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_role_grants TO authenticated;
GRANT ALL ON public.pending_role_grants TO service_role;

ALTER TABLE public.pending_role_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pending grants"
  ON public.pending_role_grants
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: when a new auth user is created, apply any matching pending role
CREATE OR REPLACE FUNCTION public.apply_pending_role_grants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;
  FOR rec IN
    SELECT id, role FROM public.pending_role_grants
    WHERE lower(email) = lower(NEW.email) AND applied_at IS NULL
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, rec.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.pending_role_grants
      SET applied_at = now(), applied_user_id = NEW.id
      WHERE id = rec.id;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_apply_pending_roles ON auth.users;
CREATE TRIGGER on_auth_user_created_apply_pending_roles
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.apply_pending_role_grants();
