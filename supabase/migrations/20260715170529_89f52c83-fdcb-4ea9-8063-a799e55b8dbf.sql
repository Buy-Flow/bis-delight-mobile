UPDATE public.orders
SET status = 'cancelado'
WHERE status = 'pendente'
  AND payment_method IN ('pix', 'asaas_checkout', 'asaas_pix', 'asaas_card', 'credit_card')
  AND created_at < now() - interval '30 minutes';

DROP FUNCTION IF EXISTS public.auto_cancel_expired_pending_orders();

CREATE OR REPLACE FUNCTION public.auto_cancel_expired_pending_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'cancelado'
  WHERE status = 'pendente'
    AND payment_method IN ('pix', 'asaas_checkout', 'asaas_pix', 'asaas_card', 'credit_card')
    AND created_at < now() - interval '30 minutes';
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-cancel-pending-orders');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'auto-cancel-pending-orders',
  '* * * * *',
  $$SELECT public.auto_cancel_expired_pending_orders();$$
);