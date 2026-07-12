
CREATE OR REPLACE FUNCTION public.cpf_exists(_cpf text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE cpf = _cpf);
$$;

REVOKE EXECUTE ON FUNCTION public.cpf_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cpf_exists(text) TO anon, authenticated;
