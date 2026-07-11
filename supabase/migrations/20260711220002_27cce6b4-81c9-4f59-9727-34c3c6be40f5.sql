
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique_idx ON public.profiles (cpf) WHERE cpf IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  bday_text text;
  bday_date date;
  cpf_raw text;
  cpf_clean text;
BEGIN
  IF (SELECT count(*) FROM public.user_roles WHERE role='admin') = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  bday_text := NULLIF(NEW.raw_user_meta_data->>'birthday', '');
  BEGIN
    bday_date := bday_text::date;
  EXCEPTION WHEN OTHERS THEN
    bday_date := NULL;
  END;

  cpf_raw := NULLIF(NEW.raw_user_meta_data->>'cpf', '');
  cpf_clean := NULLIF(regexp_replace(COALESCE(cpf_raw,''), '\D', '', 'g'), '');
  IF cpf_clean IS NOT NULL AND length(cpf_clean) <> 11 THEN
    cpf_clean := NULL;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, birthday, cpf) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    bday_date,
    cpf_clean
  ) ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.profiles.phone),
    birthday = COALESCE(EXCLUDED.birthday, public.profiles.birthday),
    cpf = COALESCE(EXCLUDED.cpf, public.profiles.cpf);

  INSERT INTO public.loyalty (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $function$;
