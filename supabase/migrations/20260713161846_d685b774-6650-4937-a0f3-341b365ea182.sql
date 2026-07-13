
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_role_grants TO authenticated;
GRANT ALL ON public.pending_role_grants TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS pending_role_grants_email_role_open_uidx
  ON public.pending_role_grants (lower(email), role)
  WHERE applied_at IS NULL;

DROP FUNCTION IF EXISTS public.admin_list_pending_grants();

CREATE FUNCTION public.admin_list_pending_grants()
RETURNS TABLE (
  id uuid,
  email text,
  role app_role,
  full_name text,
  note text,
  granted_by_email text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.role, p.full_name, p.note,
         u.email::text AS granted_by_email,
         p.created_at
  FROM public.pending_role_grants p
  LEFT JOIN auth.users u ON u.id = p.granted_by
  WHERE p.applied_at IS NULL
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_pending_grants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_grants() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_cancel_pending_grant(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM public.pending_role_grants
  WHERE id = _id AND applied_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cancel_pending_grant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_pending_grant(uuid) TO authenticated;
