
-- Enum-like check via text for flexibility

CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  operator_name text,
  terminal text DEFAULT 'PDV-01',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_amount numeric(12,2) NOT NULL DEFAULT 0,
  counted_amount numeric(12,2),
  expected_amount numeric(12,2),
  difference numeric(12,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opening_note text,
  closing_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sessions TO authenticated;
GRANT ALL ON public.cash_sessions TO service_role;

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cash_sessions"
ON public.cash_sessions FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE UNIQUE INDEX cash_sessions_only_one_open
  ON public.cash_sessions (status) WHERE status = 'open';

CREATE TABLE public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sale','sangria','reforco','suprimento','troco','estorno','ajuste')),
  payment_method text NOT NULL DEFAULT 'dinheiro' CHECK (payment_method IN ('dinheiro','pix','debito','credito','voucher','outro')),
  amount numeric(12,2) NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cash_movements"
ON public.cash_movements FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX cash_movements_session_idx ON public.cash_movements(session_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER cash_sessions_updated
BEFORE UPDATE ON public.cash_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Get currently open session
CREATE OR REPLACE FUNCTION public.get_open_cash_session()
RETURNS public.cash_sessions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.cash_sessions WHERE status='open' ORDER BY opened_at DESC LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_open_cash_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_open_cash_session() TO authenticated;

-- Compute expected cash for a session (dinheiro entries only + opening - sangria + reforco + suprimento - troco)
CREATE OR REPLACE FUNCTION public.compute_expected_cash(_session_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(s.opening_amount,0)
    + COALESCE((SELECT SUM(amount) FROM public.cash_movements
                 WHERE session_id=_session_id AND payment_method='dinheiro'
                 AND type IN ('sale','reforco','suprimento')),0)
    - COALESCE((SELECT SUM(amount) FROM public.cash_movements
                 WHERE session_id=_session_id AND payment_method='dinheiro'
                 AND type IN ('sangria','troco','estorno')),0)
  FROM public.cash_sessions s WHERE s.id=_session_id;
$$;

REVOKE ALL ON FUNCTION public.compute_expected_cash(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_expected_cash(uuid) TO authenticated;

-- Close session with counted amount
CREATE OR REPLACE FUNCTION public.close_cash_session(_session_id uuid, _counted numeric, _note text DEFAULT NULL)
RETURNS public.cash_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _row public.cash_sessions; _expected numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT public.compute_expected_cash(_session_id) INTO _expected;
  UPDATE public.cash_sessions
     SET status='closed',
         closed_at=now(),
         counted_amount=_counted,
         expected_amount=_expected,
         difference=_counted - _expected,
         closing_note=_note
   WHERE id=_session_id AND status='open'
   RETURNING * INTO _row;
  RETURN _row;
END; $$;

REVOKE ALL ON FUNCTION public.close_cash_session(uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_cash_session(uuid,numeric,text) TO authenticated;
