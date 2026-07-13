CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  phone text,
  cpf text,
  birthday date,
  avatar_url text,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  email_confirmed_at timestamp with time zone,
  roles text[],
  orders_count bigint,
  total_spent numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      u.id,
      u.email::text,
      COALESCE(p.full_name, '')::text,
      COALESCE(p.phone, '')::text,
      COALESCE(p.cpf, '')::text,
      p.birthday,
      NULL::text AS avatar_url,
      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at,
      COALESCE(
        (
          SELECT array_agg(ur.role::text ORDER BY ur.role::text)
          FROM public.user_roles ur
          WHERE ur.user_id = u.id
        ),
        ARRAY[]::text[]
      ) AS roles,
      COALESCE(
        (
          SELECT count(*)
          FROM public.orders o
          WHERE o.user_id = u.id AND o.status = 'pago'
        ),
        0
      ) AS orders_count,
      COALESCE(
        (
          SELECT sum(o.total)
          FROM public.orders o
          WHERE o.user_id = u.id AND o.status = 'pago'
        ),
        0
      ) AS total_spent
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    ORDER BY u.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO service_role;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM anon, public;