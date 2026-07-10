
DROP POLICY IF EXISTS "Users manage own abandoned cart" ON public.abandoned_carts;

CREATE POLICY "Users select own abandoned cart"
  ON public.abandoned_carts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own abandoned cart"
  ON public.abandoned_carts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own abandoned cart"
  ON public.abandoned_carts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own abandoned cart"
  ON public.abandoned_carts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
