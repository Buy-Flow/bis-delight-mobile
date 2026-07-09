-- Valida um cupom (sem marcar como usado). Só retorna se pertence ao usuário logado e não foi utilizado.
CREATE OR REPLACE FUNCTION public.validate_loyalty_coupon(_code text)
RETURNS TABLE(id uuid, code text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
    SELECT c.id, c.code
      FROM public.loyalty_coupons c
     WHERE c.code = upper(btrim(_code))
       AND c.user_id = _uid
       AND c.used_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_loyalty_coupon(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_loyalty_coupon(text) TO authenticated;

-- Resgata um cupom atomicamente. Falha se código inválido, de outra conta, ou já usado.
CREATE OR REPLACE FUNCTION public.redeem_loyalty_coupon(_code text)
RETURNS TABLE(id uuid, code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
  _code_out text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.loyalty_coupons
     SET used_at = now()
   WHERE loyalty_coupons.code = upper(btrim(_code))
     AND loyalty_coupons.user_id = _uid
     AND loyalty_coupons.used_at IS NULL
   RETURNING loyalty_coupons.id, loyalty_coupons.code
     INTO _id, _code_out;

  IF _id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_used_coupon' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY SELECT _id, _code_out;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_loyalty_coupon(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_coupon(text) TO authenticated;