
-- Fix Users & Permissions: grants missing on pending_role_grants and add admin_list_pending RPC.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_role_grants TO authenticated;
GRANT ALL ON public.pending_role_grants TO service_role;

-- Ensure a unique key so admins can upsert (email lowercase + role, only while pending)
DROP INDEX IF EXISTS public.pending_role_grants_email_role_key;
CREATE UNIQUE INDEX pending_role_grants_email_role_key
  ON public.pending_role_grants (lower(email), role)
  WHERE applied_at IS NULL;

-- List pending (unapplied) role assignments for admins
CREATE OR REPLACE FUNCTION public.admin_list_pending_grants()
RETURNS TABLE(
  id uuid,
  email text,
  role text,
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
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id,
           p.email,
           p.role::text,
           p.full_name,
           p.note,
           (SELECT u.email::text FROM auth.users u WHERE u.id = p.granted_by),
           p.created_at
    FROM public.pending_role_grants p
    WHERE p.applied_at IS NULL
    ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_pending_grants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_grants() TO authenticated, service_role;

-- Cancel a pending grant
CREATE OR REPLACE FUNCTION public.admin_cancel_pending_grant(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.pending_role_grants WHERE id = _id AND applied_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cancel_pending_grant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_pending_grant(uuid) TO authenticated, service_role;
