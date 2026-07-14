
REVOKE EXECUTE ON FUNCTION public.admin_update_cash_close_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_cash_close_settings(jsonb) TO authenticated, service_role;
