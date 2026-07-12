
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_role(uuid, public.app_role, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_role(uuid, public.app_role, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_role_audit(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_role(uuid, public.app_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(uuid, public.app_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_role_audit(int) TO authenticated;
