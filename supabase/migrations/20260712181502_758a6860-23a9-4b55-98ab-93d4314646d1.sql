
-- =========================================================
-- MESAS: gestão de salão / comandas presenciais
-- =========================================================

-- 1) Tabela de mesas do salão
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number int NOT NULL,
  label text,
  seats int NOT NULL DEFAULT 4,
  zone text NOT NULL DEFAULT 'Salão',
  status text NOT NULL DEFAULT 'livre'
    CHECK (status IN ('livre','ocupada','reservada','aguardando_pagamento','limpeza')),
  waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL,
  current_order_id uuid,
  people_count int,
  opened_at timestamptz,
  notes text,
  pos_x numeric,
  pos_y numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tables"
  ON public.restaurant_tables FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_restaurant_tables_updated_at
  BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Vincular mesa ao pedido
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_id uuid
  REFERENCES public.restaurant_tables(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS people_count int;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_fee numeric(10,2) DEFAULT 0;
CREATE INDEX IF NOT EXISTS orders_table_id_idx ON public.orders(table_id) WHERE table_id IS NOT NULL;

-- Permitir mode='mesa' no constraint (se existir)
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
    FROM pg_constraint
   WHERE conrelid = 'public.orders'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%mode%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', con_name);
  END IF;
END $$;
ALTER TABLE public.orders ADD CONSTRAINT orders_mode_check
  CHECK (mode IN ('entrega','retirada','mesa','balcao'));

-- 3) Trigger: quando pedido de mesa fica 'pago' ou 'cancelado', libera a mesa
CREATE OR REPLACE FUNCTION public.release_table_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.table_id IS NOT NULL
     AND NEW.status IN ('pago','entregue','cancelado')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.restaurant_tables
       SET status = 'limpeza',
           current_order_id = NULL,
           opened_at = NULL,
           waiter_id = NULL,
           people_count = NULL,
           notes = NULL
     WHERE id = NEW.table_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_table_on_paid ON public.orders;
CREATE TRIGGER trg_release_table_on_paid
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.release_table_on_paid();

-- 4) Seed inicial de mesas (Salão 1-8, Varanda 9-12, Balcão 13-14)
INSERT INTO public.restaurant_tables (number, seats, zone, pos_x, pos_y) VALUES
  (1,  4, 'Salão',   1, 1),
  (2,  4, 'Salão',   2, 1),
  (3,  4, 'Salão',   3, 1),
  (4,  4, 'Salão',   4, 1),
  (5,  6, 'Salão',   1, 2),
  (6,  6, 'Salão',   2, 2),
  (7,  4, 'Salão',   3, 2),
  (8,  4, 'Salão',   4, 2),
  (9,  2, 'Varanda', 1, 1),
  (10, 2, 'Varanda', 2, 1),
  (11, 4, 'Varanda', 3, 1),
  (12, 4, 'Varanda', 4, 1),
  (13, 2, 'Balcão',  1, 1),
  (14, 2, 'Balcão',  2, 1)
ON CONFLICT (number) DO NOTHING;

-- 5) RPC: abrir mesa (cria comanda/order vazia e trava a mesa)
CREATE OR REPLACE FUNCTION public.open_table(_table_id uuid, _people int DEFAULT NULL, _waiter_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order_id uuid;
  _t public.restaurant_tables%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _t FROM public.restaurant_tables WHERE id = _table_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'table_not_found' USING ERRCODE = 'P0001'; END IF;
  IF _t.status = 'ocupada' AND _t.current_order_id IS NOT NULL THEN
    RETURN _t.current_order_id;
  END IF;

  INSERT INTO public.orders (mode, status, total, table_id, people_count, delivery_fee, subtotal)
  VALUES ('mesa', 'novo', 0, _table_id, _people, 0, 0)
  RETURNING id INTO _order_id;

  UPDATE public.restaurant_tables
     SET status = 'ocupada',
         current_order_id = _order_id,
         opened_at = now(),
         people_count = _people,
         waiter_id = COALESCE(_waiter_id, waiter_id)
   WHERE id = _table_id;

  RETURN _order_id;
END;
$$;

-- 6) RPC: transferir mesa (move a comanda ativa de uma mesa para outra)
CREATE OR REPLACE FUNCTION public.transfer_table(_from uuid, _to uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order_id uuid;
  _from_t public.restaurant_tables%ROWTYPE;
  _to_t public.restaurant_tables%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _from_t FROM public.restaurant_tables WHERE id = _from FOR UPDATE;
  SELECT * INTO _to_t FROM public.restaurant_tables WHERE id = _to FOR UPDATE;
  IF _from_t.current_order_id IS NULL THEN RAISE EXCEPTION 'source_empty' USING ERRCODE = 'P0001'; END IF;
  IF _to_t.status = 'ocupada' THEN RAISE EXCEPTION 'target_busy' USING ERRCODE = 'P0001'; END IF;

  _order_id := _from_t.current_order_id;
  UPDATE public.orders SET table_id = _to WHERE id = _order_id;
  UPDATE public.restaurant_tables
     SET status='ocupada', current_order_id=_order_id,
         opened_at=_from_t.opened_at, waiter_id=_from_t.waiter_id,
         people_count=_from_t.people_count, notes=_from_t.notes
   WHERE id = _to;
  UPDATE public.restaurant_tables
     SET status='limpeza', current_order_id=NULL, opened_at=NULL,
         waiter_id=NULL, people_count=NULL, notes=NULL
   WHERE id = _from;
END;
$$;

-- 7) RPC: liberar mesa após limpeza
CREATE OR REPLACE FUNCTION public.clear_table(_table_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.restaurant_tables
     SET status='livre', current_order_id=NULL, opened_at=NULL,
         waiter_id=NULL, people_count=NULL, notes=NULL
   WHERE id = _table_id;
END;
$$;
