
CREATE TABLE public.shared_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name text NOT NULL DEFAULT 'Anônimo',
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  merged_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_carts TO authenticated;
GRANT ALL ON public.shared_carts TO service_role;

ALTER TABLE public.shared_carts ENABLE ROW LEVEL SECURITY;

-- Dono vê e edita as próprias linhas
CREATE POLICY "shared_carts_owner_select" ON public.shared_carts
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());
CREATE POLICY "shared_carts_owner_update" ON public.shared_carts
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "shared_carts_owner_delete" ON public.shared_carts
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());
-- Admins podem visualizar todos
CREATE POLICY "shared_carts_admin_select" ON public.shared_carts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX shared_carts_token_idx ON public.shared_carts(token);
CREATE INDEX shared_carts_owner_idx ON public.shared_carts(owner_user_id);
CREATE INDEX shared_carts_status_idx ON public.shared_carts(status, expires_at);

-- Trigger updated_at
CREATE TRIGGER shared_carts_touch
  BEFORE UPDATE ON public.shared_carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RPC: criar ============
CREATE OR REPLACE FUNCTION public.create_shared_cart(
  _title text, _message text, _owner_name text, _items jsonb
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _token text; _tries int := 0; _uid uuid := auth.uid(); _owner text;
BEGIN
  _owner := COALESCE(NULLIF(btrim(_owner_name),''), 'Anônimo');
  LOOP
    _token := lower(substring(replace(gen_random_uuid()::text,'-',''), 1, 8));
    BEGIN
      INSERT INTO public.shared_carts (token, owner_user_id, owner_name, title, message, items, participants)
      VALUES (
        _token, _uid, _owner,
        COALESCE(_title,''), COALESCE(_message,''),
        COALESCE(_items, '[]'::jsonb),
        jsonb_build_array(jsonb_build_object(
          'name', _owner, 'is_owner', true, 'joined_at', now()
        ))
      );
      RETURN _token;
    EXCEPTION WHEN unique_violation THEN
      _tries := _tries + 1;
      IF _tries > 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

-- ============ RPC: ler ============
CREATE OR REPLACE FUNCTION public.get_shared_cart(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.shared_carts%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 4 THEN RETURN NULL; END IF;
  SELECT * INTO r FROM public.shared_carts WHERE token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'token', r.token,
    'owner_name', r.owner_name,
    'is_owner', (r.owner_user_id IS NOT NULL AND r.owner_user_id = auth.uid()),
    'title', r.title,
    'message', r.message,
    'items', r.items,
    'participants', r.participants,
    'status', CASE WHEN r.expires_at < now() AND r.status='open' THEN 'expired' ELSE r.status END,
    'expires_at', r.expires_at,
    'created_at', r.created_at,
    'merged_order_id', r.merged_order_id
  );
END $$;

-- ============ RPC: participante adiciona item ============
CREATE OR REPLACE FUNCTION public.add_shared_cart_item(_token text, _participant text, _item jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.shared_carts%ROWTYPE; _pname text; _new_item jsonb; _already boolean;
BEGIN
  _pname := COALESCE(NULLIF(btrim(_participant),''), 'Anônimo');
  SELECT * INTO r FROM public.shared_carts WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0001'; END IF;
  IF r.status <> 'open' OR r.expires_at < now() THEN
    RAISE EXCEPTION 'closed' USING ERRCODE='P0001';
  END IF;
  IF jsonb_typeof(_item) <> 'object' THEN RAISE EXCEPTION 'bad_item' USING ERRCODE='P0001'; END IF;

  _new_item := _item
    || jsonb_build_object('participant', _pname)
    || jsonb_build_object('added_at', to_jsonb(now()));

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(r.participants) el WHERE el->>'name' = _pname
  ) INTO _already;

  UPDATE public.shared_carts SET
    items = items || jsonb_build_array(_new_item),
    participants = CASE WHEN _already THEN participants
      ELSE participants || jsonb_build_array(jsonb_build_object(
        'name', _pname, 'joined_at', now()
      ))
    END,
    updated_at = now()
  WHERE token = _token;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ============ RPC: remover próprio item ============
CREATE OR REPLACE FUNCTION public.remove_shared_cart_item(_token text, _uid text, _participant text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.shared_carts%ROWTYPE; _filtered jsonb; _is_owner boolean;
BEGIN
  SELECT * INTO r FROM public.shared_carts WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0001'; END IF;
  _is_owner := (r.owner_user_id IS NOT NULL AND r.owner_user_id = auth.uid());

  SELECT COALESCE(jsonb_agg(el), '[]'::jsonb) INTO _filtered
    FROM jsonb_array_elements(r.items) el
    WHERE NOT (
      (el->>'uid' = _uid)
      AND (_is_owner OR el->>'participant' = _participant)
    );
  UPDATE public.shared_carts SET items = _filtered, updated_at = now() WHERE token = _token;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ============ RPC: dono fecha ============
CREATE OR REPLACE FUNCTION public.close_shared_cart(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.shared_carts SET status = 'closed', updated_at = now()
   WHERE token = _token AND owner_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ============ RPC: dono marca como consolidado num pedido ============
CREATE OR REPLACE FUNCTION public.merge_shared_cart(_token text, _order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.shared_carts
     SET status = 'merged', merged_order_id = _order_id, updated_at = now()
   WHERE token = _token AND owner_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.create_shared_cart(text,text,text,jsonb) FROM public;
REVOKE ALL ON FUNCTION public.get_shared_cart(text) FROM public;
REVOKE ALL ON FUNCTION public.add_shared_cart_item(text,text,jsonb) FROM public;
REVOKE ALL ON FUNCTION public.remove_shared_cart_item(text,text,text) FROM public;
REVOKE ALL ON FUNCTION public.close_shared_cart(text) FROM public;
REVOKE ALL ON FUNCTION public.merge_shared_cart(text,uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.create_shared_cart(text,text,text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_cart(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_shared_cart_item(text,text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_shared_cart_item(text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_shared_cart(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_shared_cart(text,uuid) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_carts;
