
-- Expand app_role enum with granular roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='manager' AND enumtypid=(SELECT oid FROM pg_type WHERE typname='app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'manager';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='staff' AND enumtypid=(SELECT oid FROM pg_type WHERE typname='app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'staff';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='kitchen' AND enumtypid=(SELECT oid FROM pg_type WHERE typname='app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'kitchen';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='delivery' AND enumtypid=(SELECT oid FROM pg_type WHERE typname='app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'delivery';
  END IF;
END $$;

-- Audit log for permission changes
CREATE TABLE IF NOT EXISTS public.user_role_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  target_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('grant','revoke')),
  role public.app_role NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_role_audit TO authenticated;
GRANT ALL ON public.user_role_audit TO service_role;
ALTER TABLE public.user_role_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read audit" ON public.user_role_audit;
CREATE POLICY "admins read audit" ON public.user_role_audit
  FOR SELECT USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admins insert audit" ON public.user_role_audit;
CREATE POLICY "admins insert audit" ON public.user_role_audit
  FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'));

-- List all users with profile + roles (admin only)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  cpf text,
  birthday date,
  avatar_url text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  roles text[],
  orders_count bigint,
  total_spent numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT
      u.id,
      u.email::text,
      COALESCE(p.full_name,''),
      COALESCE(p.phone,''),
      COALESCE(p.cpf,''),
      p.birthday,
      p.avatar_url,
      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at,
      COALESCE((SELECT array_agg(ur.role::text ORDER BY ur.role::text) FROM public.user_roles ur WHERE ur.user_id = u.id), ARRAY[]::text[]),
      COALESCE((SELECT count(*) FROM public.orders o WHERE o.user_id = u.id AND o.status='pago'),0),
      COALESCE((SELECT sum(o.total) FROM public.orders o WHERE o.user_id = u.id AND o.status='pago'),0)
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

-- Grant role
CREATE OR REPLACE FUNCTION public.admin_grant_role(_target uuid, _role public.app_role, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.user_role_audit (actor_id, target_user_id, action, role, note)
    VALUES (auth.uid(), _target, 'grant', _role, _note);
END;
$$;

-- Revoke role (with safety: never remove last admin)
CREATE OR REPLACE FUNCTION public.admin_revoke_role(_target uuid, _role public.app_role, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_count int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF _role = 'admin' THEN
    SELECT count(*) INTO _admin_count FROM public.user_roles WHERE role='admin';
    IF _admin_count <= 1 THEN
      RAISE EXCEPTION 'cannot_remove_last_admin' USING ERRCODE = 'P0001';
    END IF;
    IF _target = auth.uid() THEN
      RAISE EXCEPTION 'cannot_remove_own_admin' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _target AND role = _role;
  INSERT INTO public.user_role_audit (actor_id, target_user_id, action, role, note)
    VALUES (auth.uid(), _target, 'revoke', _role, _note);
END;
$$;

-- List audit trail
CREATE OR REPLACE FUNCTION public.admin_list_role_audit(_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  actor_email text,
  actor_name text,
  target_email text,
  target_name text,
  action text,
  role text,
  note text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT
      a.id,
      ua.email::text,
      COALESCE(pa.full_name,''),
      ut.email::text,
      COALESCE(pt.full_name,''),
      a.action,
      a.role::text,
      a.note,
      a.created_at
    FROM public.user_role_audit a
    LEFT JOIN auth.users ua ON ua.id = a.actor_id
    LEFT JOIN public.profiles pa ON pa.id = a.actor_id
    LEFT JOIN auth.users ut ON ut.id = a.target_user_id
    LEFT JOIN public.profiles pt ON pt.id = a.target_user_id
    ORDER BY a.created_at DESC
    LIMIT _limit;
END;
$$;
