CREATE OR REPLACE FUNCTION public.notify_admin_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  should_notify boolean := false;
  method_lc text := lower(coalesce(NEW.payment_method, ''));
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Allowlist: only notify at INSERT when paid, or when using an explicit offline method.
    -- Any online/unknown/null method must wait for status='pago' (handled by the UPDATE branch).
    should_notify := NEW.status = 'pago'
      OR method_lc IN ('whatsapp', 'dinheiro', 'cash', 'pos', 'presencial');
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
$function$;