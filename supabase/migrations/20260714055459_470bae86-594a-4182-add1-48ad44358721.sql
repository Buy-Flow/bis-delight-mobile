CREATE OR REPLACE FUNCTION public.set_tracking_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_token IS NULL THEN
    NEW.tracking_token := encode(extensions.gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_tracking_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tracking_token() TO authenticated, service_role;