
-- Expand allowed status values
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['pendente'::text,'pago'::text,'preparando'::text,'entregue'::text,'cancelado'::text,'novo'::text]));

-- Backfill 'novo' → 'pendente'
UPDATE public.orders SET status = 'pendente' WHERE status = 'novo';

-- New default
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pendente';

-- Loyalty stamps only for paid orders
DROP TRIGGER IF EXISTS orders_grant_loyalty ON public.orders;

CREATE OR REPLACE FUNCTION public.grant_loyalty_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_stamps int;
  bonus int := 0;
  this_month text := to_char(now(), 'YYYY-MM');
  bday date;
  last_bonus text;
  new_code text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pago' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pago' THEN RETURN NEW; END IF;
  IF NEW.total < 20 THEN RETURN NEW; END IF;

  INSERT INTO public.loyalty (user_id) VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT birthday INTO bday FROM public.profiles WHERE id = NEW.user_id;
  SELECT last_birthday_bonus INTO last_bonus FROM public.loyalty WHERE user_id = NEW.user_id;
  IF bday IS NOT NULL
     AND to_char(bday, 'MM') = to_char(now(), 'MM')
     AND (last_bonus IS NULL OR last_bonus <> this_month) THEN
    bonus := 1;
    UPDATE public.loyalty SET last_birthday_bonus = this_month WHERE user_id = NEW.user_id;
  END IF;
  UPDATE public.loyalty SET stamps = stamps + 1 + bonus
  WHERE user_id = NEW.user_id RETURNING stamps INTO current_stamps;
  WHILE current_stamps >= 10 LOOP
    new_code := 'BIS-' || upper(substring(replace(gen_random_uuid()::text,'-',''), 1, 8));
    INSERT INTO public.loyalty_coupons (user_id, code) VALUES (NEW.user_id, new_code);
    UPDATE public.loyalty SET stamps = stamps - 10, total_redeemed = total_redeemed + 1
    WHERE user_id = NEW.user_id RETURNING stamps INTO current_stamps;
  END LOOP;
  RETURN NEW;
END; $function$;

CREATE TRIGGER orders_grant_loyalty
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.grant_loyalty_stamp();
