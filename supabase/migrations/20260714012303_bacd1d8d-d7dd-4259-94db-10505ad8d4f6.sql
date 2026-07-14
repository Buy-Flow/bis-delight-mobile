
CREATE TABLE public.cash_close_settings (
  id            int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled       boolean NOT NULL DEFAULT true,
  send_hour     int     NOT NULL DEFAULT 23  CHECK (send_hour BETWEEN 0 AND 23),
  send_minute   int     NOT NULL DEFAULT 55  CHECK (send_minute BETWEEN 0 AND 59),
  timezone      text    NOT NULL DEFAULT 'America/Sao_Paulo',
  weekdays      int[]   NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  whatsapp_numbers text[] NOT NULL DEFAULT ARRAY[]::text[],
  send_pdf      boolean NOT NULL DEFAULT true,
  send_text_summary boolean NOT NULL DEFAULT true,
  include_pending boolean NOT NULL DEFAULT false,
  include_canceled boolean NOT NULL DEFAULT false,
  auto_close_session boolean NOT NULL DEFAULT false,
  custom_header text    NOT NULL DEFAULT '',
  custom_footer text    NOT NULL DEFAULT 'Relatório gerado automaticamente pelo Quero Bis.',
  logo_url      text,
  email_backup  text[]  NOT NULL DEFAULT ARRAY[]::text[],
  last_run_at   timestamptz,
  last_run_status text,
  last_run_error  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cash_close_settings TO authenticated;
GRANT ALL ON public.cash_close_settings TO service_role;
ALTER TABLE public.cash_close_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read cash_close_settings" ON public.cash_close_settings
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER cash_close_settings_touch
BEFORE UPDATE ON public.cash_close_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.cash_close_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.cash_close_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date    date NOT NULL,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  triggered_by   text NOT NULL DEFAULT 'manual',
  triggered_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  totals         jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_path       text,
  whatsapp_status text NOT NULL DEFAULT 'pending',
  whatsapp_error  text,
  whatsapp_targets text[],
  sent_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cash_close_reports TO authenticated;
GRANT ALL ON public.cash_close_reports TO service_role;
ALTER TABLE public.cash_close_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read cash_close_reports" ON public.cash_close_reports
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX cash_close_reports_date_idx ON public.cash_close_reports (report_date DESC);

CREATE OR REPLACE FUNCTION public.get_cash_close_aggregate(_date date, _include_pending boolean DEFAULT false, _include_canceled boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := (_date::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_end   timestamptz := ((_date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_orders jsonb; v_by_mode jsonb; v_by_status jsonb; v_payments jsonb;
  v_sessions jsonb; v_movements jsonb; v_top_products jsonb; v_hourly jsonb;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(),'admin')
     AND NOT public.has_role(auth.uid(),'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;

  SELECT jsonb_build_object(
    'orders_count',   COALESCE(count(*),0),
    'revenue',        COALESCE(sum(total),0),
    'subtotal',       COALESCE(sum(subtotal),0),
    'delivery_fees',  COALESCE(sum(delivery_fee),0),
    'service_fees',   COALESCE(sum(service_fee),0),
    'avg_ticket',     COALESCE(avg(total),0)
  ) INTO v_orders
  FROM public.orders
  WHERE created_at >= v_start AND created_at < v_end
    AND (
      status IN ('pago','preparando','saiu_para_entrega','entregue')
      OR (_include_pending AND status IN ('pendente','novo'))
      OR (_include_canceled AND status = 'cancelado')
    );

  SELECT COALESCE(jsonb_agg(jsonb_build_object('mode',mode,'count',c,'revenue',r) ORDER BY r DESC),'[]'::jsonb) INTO v_by_mode
  FROM (SELECT mode, count(*) c, sum(total) r FROM public.orders
        WHERE created_at >= v_start AND created_at < v_end
          AND status IN ('pago','preparando','saiu_para_entrega','entregue')
        GROUP BY mode) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('status',status,'count',c,'revenue',r) ORDER BY c DESC),'[]'::jsonb) INTO v_by_status
  FROM (SELECT status, count(*) c, sum(total) r FROM public.orders
        WHERE created_at >= v_start AND created_at < v_end GROUP BY status) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('method',payment_method,'count',c,'amount',a) ORDER BY a DESC),'[]'::jsonb) INTO v_payments
  FROM (SELECT payment_method, count(*) c, sum(amount) a FROM public.cash_movements
        WHERE created_at >= v_start AND created_at < v_end AND type='sale'
        GROUP BY payment_method) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',id,'operator_name',operator_name,'terminal',terminal,
    'opened_at',opened_at,'closed_at',closed_at,'status',status,
    'opening_amount',opening_amount,'counted_amount',counted_amount,
    'expected_amount',expected_amount,'difference',difference) ORDER BY opened_at),'[]'::jsonb) INTO v_sessions
  FROM public.cash_sessions
  WHERE opened_at < v_end AND (closed_at IS NULL OR closed_at >= v_start);

  SELECT COALESCE(jsonb_object_agg(type, jsonb_build_object('count',c,'amount',a)), '{}'::jsonb) INTO v_movements
  FROM (SELECT type, count(*) c, sum(amount) a FROM public.cash_movements
        WHERE created_at >= v_start AND created_at < v_end GROUP BY type) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('product_name',product_name,'qty',qty,'revenue',revenue) ORDER BY revenue DESC),'[]'::jsonb) INTO v_top_products
  FROM (SELECT oi.product_name, sum(oi.quantity)::int qty, sum(oi.price*oi.quantity) revenue
        FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
        WHERE o.created_at >= v_start AND o.created_at < v_end
          AND o.status IN ('pago','preparando','saiu_para_entrega','entregue')
        GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 10) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('hour',h,'revenue',r,'count',c) ORDER BY h),'[]'::jsonb) INTO v_hourly
  FROM (SELECT extract(hour from (created_at AT TIME ZONE 'America/Sao_Paulo'))::int h,
               sum(total) r, count(*) c FROM public.orders
        WHERE created_at >= v_start AND created_at < v_end
          AND status IN ('pago','preparando','saiu_para_entrega','entregue')
        GROUP BY 1) t;

  RETURN jsonb_build_object(
    'date', _date, 'window_start', v_start, 'window_end', v_end,
    'orders', v_orders, 'by_mode', v_by_mode, 'by_status', v_by_status,
    'payments', v_payments, 'sessions', v_sessions, 'movements', v_movements,
    'top_products', v_top_products, 'hourly', v_hourly
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_cash_close_aggregate(date, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cash_close_aggregate(date, boolean, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_update_cash_close_settings(_patch jsonb)
RETURNS public.cash_close_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.cash_close_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  UPDATE public.cash_close_settings SET
    enabled = COALESCE((_patch->>'enabled')::boolean, enabled),
    send_hour = COALESCE((_patch->>'send_hour')::int, send_hour),
    send_minute = COALESCE((_patch->>'send_minute')::int, send_minute),
    timezone = COALESCE(_patch->>'timezone', timezone),
    weekdays = COALESCE((SELECT array_agg((x)::int) FROM jsonb_array_elements_text(COALESCE(_patch->'weekdays','null'::jsonb)) x), weekdays),
    whatsapp_numbers = COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(_patch->'whatsapp_numbers','null'::jsonb)) x), whatsapp_numbers),
    email_backup = COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(_patch->'email_backup','null'::jsonb)) x), email_backup),
    send_pdf = COALESCE((_patch->>'send_pdf')::boolean, send_pdf),
    send_text_summary = COALESCE((_patch->>'send_text_summary')::boolean, send_text_summary),
    include_pending = COALESCE((_patch->>'include_pending')::boolean, include_pending),
    include_canceled = COALESCE((_patch->>'include_canceled')::boolean, include_canceled),
    auto_close_session = COALESCE((_patch->>'auto_close_session')::boolean, auto_close_session),
    custom_header = COALESCE(_patch->>'custom_header', custom_header),
    custom_footer = COALESCE(_patch->>'custom_footer', custom_footer),
    logo_url = COALESCE(_patch->>'logo_url', logo_url),
    updated_at = now()
  WHERE id = 1 RETURNING * INTO _row;
  RETURN _row;
END; $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$ BEGIN PERFORM cron.unschedule('cash-close-daily-tick'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'cash-close-daily-tick', '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://querobis.lovable.app/api/public/cash-close-cron',
    headers := jsonb_build_object('Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbnRqaXhzaXNhd3dibGNnd3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNzAyMDksImV4cCI6MjA5ODk0NjIwOX0.QaPlJ4Kx3jJZC96CR55Lwk88ZAGFaAQTvjJvgB9-tt0'),
    body := jsonb_build_object('source','pg_cron')
  );
  $cron$
);
