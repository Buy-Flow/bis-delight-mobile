ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['pendente'::text, 'pago'::text, 'preparando'::text, 'saiu_para_entrega'::text, 'entregue'::text, 'cancelado'::text, 'novo'::text]));