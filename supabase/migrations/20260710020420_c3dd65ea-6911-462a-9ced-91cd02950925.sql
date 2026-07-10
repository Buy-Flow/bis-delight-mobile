
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_admin_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lcntjixsisawwblcgwry.supabase.co/functions/v1/notify-admin-order',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer 07496b17b76857e8412c92a4b5ec56c998a3ece159bfbc225db4750ed8437b1b'
    ),
    body := jsonb_build_object('orderId', NEW.id::text)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_order ON public.orders;
CREATE TRIGGER trg_notify_admin_new_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_order();
