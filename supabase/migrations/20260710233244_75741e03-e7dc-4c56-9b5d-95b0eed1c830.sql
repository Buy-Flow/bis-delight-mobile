
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparing_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_order_status_times()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pago' AND NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
    IF NEW.status = 'preparando' AND NEW.preparing_at IS NULL THEN NEW.preparing_at := now(); END IF;
    IF NEW.status = 'saiu_para_entrega' AND NEW.dispatched_at IS NULL THEN NEW.dispatched_at := now(); END IF;
    IF NEW.status = 'entregue' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;
    IF NEW.status = 'cancelado' AND NEW.canceled_at IS NULL THEN NEW.canceled_at := now(); END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'pago' AND NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
    IF NEW.status = 'preparando' AND NEW.preparing_at IS NULL THEN NEW.preparing_at := now(); END IF;
    IF NEW.status = 'saiu_para_entrega' AND NEW.dispatched_at IS NULL THEN NEW.dispatched_at := now(); END IF;
    IF NEW.status = 'entregue' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;
    IF NEW.status = 'cancelado' AND NEW.canceled_at IS NULL THEN NEW.canceled_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_order_status_times ON public.orders;
CREATE TRIGGER trg_stamp_order_status_times
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.stamp_order_status_times();

-- Backfill best-effort from created_at for terminal statuses
UPDATE public.orders SET delivered_at = COALESCE(delivered_at, created_at) WHERE status = 'entregue' AND delivered_at IS NULL;
UPDATE public.orders SET canceled_at = COALESCE(canceled_at, created_at) WHERE status = 'cancelado' AND canceled_at IS NULL;
UPDATE public.orders SET paid_at = COALESCE(paid_at, created_at) WHERE status IN ('pago','preparando','saiu_para_entrega','entregue') AND paid_at IS NULL;
