
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.auto_cancel_expired_pending_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH updated AS (
    UPDATE public.orders
    SET status = 'cancelado',
        canceled_at = now(),
        notes = COALESCE(NULLIF(notes,'') || E'\n', '') || '[AUTO] Cancelado por falta de pagamento após 30 minutos'
    WHERE status = 'aguardando_pagamento'
      AND (
        (pix_expires_at IS NOT NULL AND pix_expires_at < now())
        OR (created_at < now() - interval '30 minutes')
      )
    RETURNING 1
  )
  SELECT count(*) INTO affected FROM updated;
  RETURN affected;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_cancel_expired_pending_orders() FROM PUBLIC, anon, authenticated;

-- Remove agendamento anterior se existir
DO $$
BEGIN
  PERFORM cron.unschedule('auto-cancel-expired-pending-orders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-cancel-expired-pending-orders',
  '*/2 * * * *',
  $$ SELECT public.auto_cancel_expired_pending_orders(); $$
);
