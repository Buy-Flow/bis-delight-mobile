
-- Fix print_jobs: restrict SELECT to admins
DROP POLICY IF EXISTS "print_jobs read authenticated" ON public.print_jobs;
CREATE POLICY "print_jobs admin read" ON public.print_jobs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix product_recipes: restrict SELECT to admins
DROP POLICY IF EXISTS "auth read recipes" ON public.product_recipes;
CREATE POLICY "product_recipes admin read" ON public.product_recipes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Revoke public/anon EXECUTE on all SECURITY DEFINER functions in public schema.
-- These functions either check auth.uid() or has_role internally, and should
-- not be callable by anonymous users through the Data API.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon;',
                   r.proname, r.args);
  END LOOP;
END $$;
