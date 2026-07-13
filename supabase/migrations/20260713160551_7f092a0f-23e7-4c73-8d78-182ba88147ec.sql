
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_role_grants TO authenticated;
GRANT ALL ON public.pending_role_grants TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS pending_role_grants_email_role_key
  ON public.pending_role_grants (lower(email), role)
  WHERE applied_at IS NULL;
