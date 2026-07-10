ALTER TABLE public.push_automations DROP CONSTRAINT IF EXISTS push_automations_kind_check;
ALTER TABLE public.push_automations ADD CONSTRAINT push_automations_kind_check
  CHECK (kind = ANY (ARRAY[
    'birthday'::text,
    'dormant'::text,
    'welcome'::text,
    'after_order'::text,
    'abandoned_cart'::text,
    'payment_pending'::text,
    'feedback_request'::text,
    'loyalty_close'::text,
    'weekly_promo'::text
  ]));