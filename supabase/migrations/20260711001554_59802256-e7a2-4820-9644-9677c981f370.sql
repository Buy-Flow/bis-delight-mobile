
CREATE TABLE public.user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Casa',
  address text NOT NULL,
  reference text,
  lat double precision,
  lng double precision,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_addresses TO authenticated;
GRANT ALL ON public.user_addresses TO service_role;

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own addresses" ON public.user_addresses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own addresses" ON public.user_addresses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own addresses" ON public.user_addresses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own addresses" ON public.user_addresses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX user_addresses_user_id_idx ON public.user_addresses(user_id);
CREATE UNIQUE INDEX user_addresses_one_default_per_user
  ON public.user_addresses(user_id) WHERE is_default;

CREATE TRIGGER user_addresses_set_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ensure only one default per user: if a row is marked default, unset the others
CREATE OR REPLACE FUNCTION public.user_addresses_enforce_single_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.user_addresses
       SET is_default = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_addresses_single_default
  BEFORE INSERT OR UPDATE OF is_default ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.user_addresses_enforce_single_default();
