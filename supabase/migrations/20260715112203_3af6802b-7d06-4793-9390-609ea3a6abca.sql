CREATE OR REPLACE FUNCTION public.notify_admin_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  should_notify boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Online payments are only actionable after payment confirmation.
    -- Manual/WhatsApp orders remain immediate because payment is handled outside the app.
    should_notify := NEW.status = 'pago'
      OR COALESCE(NEW.payment_method, 'whatsapp') NOT IN ('pix', 'cartao', 'credit_card', 'asaas_checkout');
  ELSIF TG_OP = 'UPDATE' THEN
    should_notify := NEW.status = 'pago'
      AND COALESCE(OLD.status, '') IS DISTINCT FROM 'pago';
  END IF;

  IF should_notify THEN
    PERFORM net.http_post(
      url := 'https://lcntjixsisawwblcgwry.supabase.co/functions/v1/notify-admin-order',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer 07496b17b76857e8412c92a4b5ec56c998a3ece159bfbc225db4750ed8437b1b'
      ),
      body := jsonb_build_object('orderId', NEW.id::text)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_order ON public.orders;
CREATE TRIGGER trg_notify_admin_new_order
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_order();