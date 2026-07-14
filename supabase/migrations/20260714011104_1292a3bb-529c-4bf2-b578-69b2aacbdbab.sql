
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_photo_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_photo_lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS delivery_photo_lng NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS delivery_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_proof_notes TEXT,
  ADD COLUMN IF NOT EXISTS delivery_proof_skipped_reason TEXT,
  ADD COLUMN IF NOT EXISTS delivery_contact_type TEXT;

CREATE TABLE IF NOT EXISTS public.proof_of_delivery_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  require_photo BOOLEAN NOT NULL DEFAULT true,
  require_signature BOOLEAN NOT NULL DEFAULT false,
  require_gps BOOLEAN NOT NULL DEFAULT true,
  require_notes BOOLEAN NOT NULL DEFAULT false,
  allow_skip BOOLEAN NOT NULL DEFAULT true,
  require_skip_reason BOOLEAN NOT NULL DEFAULT true,
  allowed_skip_reasons TEXT[] NOT NULL DEFAULT ARRAY['Cliente pediu sem foto','Portaria recebeu','Deixado com vizinho','Câmera não funcionou','Local sem iluminação']::TEXT[],
  contact_types TEXT[] NOT NULL DEFAULT ARRAY['entregue_mao','portaria','vizinho','porta','sem_contato']::TEXT[],
  min_photos INT NOT NULL DEFAULT 1 CHECK (min_photos BETWEEN 1 AND 5),
  max_photos INT NOT NULL DEFAULT 3 CHECK (max_photos BETWEEN 1 AND 5),
  photo_quality NUMERIC(3,2) NOT NULL DEFAULT 0.75 CHECK (photo_quality BETWEEN 0.3 AND 1.0),
  max_photo_kb INT NOT NULL DEFAULT 800,
  watermark BOOLEAN NOT NULL DEFAULT true,
  watermark_show_time BOOLEAN NOT NULL DEFAULT true,
  watermark_show_order BOOLEAN NOT NULL DEFAULT true,
  watermark_show_courier BOOLEAN NOT NULL DEFAULT true,
  blur_faces BOOLEAN NOT NULL DEFAULT false,
  notify_customer BOOLEAN NOT NULL DEFAULT true,
  notify_channels TEXT[] NOT NULL DEFAULT ARRAY['push','tracking']::TEXT[],
  retention_days INT NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 7 AND 365),
  block_completion_without_proof BOOLEAN NOT NULL DEFAULT true,
  alert_on_skip BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.proof_of_delivery_settings TO authenticated;
GRANT ALL ON public.proof_of_delivery_settings TO service_role;
ALTER TABLE public.proof_of_delivery_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read pod settings" ON public.proof_of_delivery_settings;
CREATE POLICY "read pod settings" ON public.proof_of_delivery_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admins manage pod settings" ON public.proof_of_delivery_settings;
CREATE POLICY "admins manage pod settings" ON public.proof_of_delivery_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

INSERT INTO public.proof_of_delivery_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "couriers upload delivery proofs" ON storage.objects;
CREATE POLICY "couriers upload delivery proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-proofs' AND public.current_courier_id() IS NOT NULL);

DROP POLICY IF EXISTS "staff read delivery proofs" ON storage.objects;
CREATE POLICY "staff read delivery proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-proofs'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'staff')
      OR public.current_courier_id() IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "admins delete delivery proofs" ON storage.objects;
CREATE POLICY "admins delete delivery proofs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'delivery-proofs' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')));

CREATE OR REPLACE FUNCTION public.complete_delivery(
  _order_id UUID,
  _photo_url TEXT DEFAULT NULL,
  _signature_url TEXT DEFAULT NULL,
  _lat NUMERIC DEFAULT NULL,
  _lng NUMERIC DEFAULT NULL,
  _notes TEXT DEFAULT NULL,
  _skipped_reason TEXT DEFAULT NULL,
  _contact_type TEXT DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_courier UUID; v_fee NUMERIC;
  v_require_photo BOOLEAN; v_allow_skip BOOLEAN;
  v_require_reason BOOLEAN; v_enabled BOOLEAN; v_block BOOLEAN;
BEGIN
  v_courier := public.current_courier_id();
  IF v_courier IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_courier'); END IF;

  SELECT enabled, require_photo, allow_skip, require_skip_reason, block_completion_without_proof
    INTO v_enabled, v_require_photo, v_allow_skip, v_require_reason, v_block
    FROM public.proof_of_delivery_settings WHERE id = 1;

  IF v_enabled AND v_require_photo AND v_block AND _photo_url IS NULL THEN
    IF NOT v_allow_skip THEN
      RETURN jsonb_build_object('ok', false, 'error', 'photo_required');
    END IF;
    IF v_require_reason AND (_skipped_reason IS NULL OR length(trim(_skipped_reason)) < 3) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'skip_reason_required');
    END IF;
  END IF;

  UPDATE public.orders
    SET status='entregue',
        delivered_at = now(),
        delivery_photo_url = COALESCE(_photo_url, delivery_photo_url),
        delivery_photo_at = CASE WHEN _photo_url IS NOT NULL THEN now() ELSE delivery_photo_at END,
        delivery_photo_lat = COALESCE(_lat, delivery_photo_lat),
        delivery_photo_lng = COALESCE(_lng, delivery_photo_lng),
        delivery_signature_url = COALESCE(_signature_url, delivery_signature_url),
        delivery_proof_notes = COALESCE(_notes, delivery_proof_notes),
        delivery_proof_skipped_reason = _skipped_reason,
        delivery_contact_type = COALESCE(_contact_type, delivery_contact_type)
    WHERE id = _order_id AND courier_id = v_courier
    RETURNING delivery_fee INTO v_fee;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'order_not_found'); END IF;

  UPDATE public.couriers
    SET total_deliveries = total_deliveries + 1,
        total_earnings = total_earnings + COALESCE(v_fee, 0),
        status = CASE WHEN (SELECT COUNT(*) FROM public.orders WHERE courier_id = v_courier AND status IN ('saiu_para_entrega','preparando','pago')) = 0 THEN 'online' ELSE 'busy' END
    WHERE id = v_courier;

  RETURN jsonb_build_object('ok', true, 'has_photo', _photo_url IS NOT NULL);
END; $function$;

CREATE OR REPLACE FUNCTION public.get_proof_of_delivery_stats(_days INT DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_start TIMESTAMPTZ := now() - (_days || ' days')::INTERVAL;
  v_total INT; v_with_photo INT; v_with_signature INT; v_with_gps INT;
  v_skipped INT; v_avg_delay NUMERIC;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'staff')) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.orders
    WHERE status = 'entregue' AND delivered_at >= v_start;
  SELECT COUNT(*) INTO v_with_photo FROM public.orders
    WHERE status = 'entregue' AND delivered_at >= v_start AND delivery_photo_url IS NOT NULL;
  SELECT COUNT(*) INTO v_with_signature FROM public.orders
    WHERE status = 'entregue' AND delivered_at >= v_start AND delivery_signature_url IS NOT NULL;
  SELECT COUNT(*) INTO v_with_gps FROM public.orders
    WHERE status = 'entregue' AND delivered_at >= v_start AND delivery_photo_lat IS NOT NULL;
  SELECT COUNT(*) INTO v_skipped FROM public.orders
    WHERE status = 'entregue' AND delivered_at >= v_start
      AND delivery_photo_url IS NULL AND delivery_proof_skipped_reason IS NOT NULL;
  SELECT AVG(EXTRACT(EPOCH FROM (delivered_at - delivery_photo_at))) INTO v_avg_delay
    FROM public.orders
    WHERE status = 'entregue' AND delivered_at >= v_start AND delivery_photo_at IS NOT NULL;

  RETURN jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'with_photo', COALESCE(v_with_photo, 0),
    'with_signature', COALESCE(v_with_signature, 0),
    'with_gps', COALESCE(v_with_gps, 0),
    'skipped', COALESCE(v_skipped, 0),
    'compliance_pct', CASE WHEN v_total > 0 THEN ROUND(100.0 * v_with_photo / v_total, 1) ELSE 0 END,
    'avg_delay_seconds', COALESCE(v_avg_delay, 0)
  );
END; $function$;

REVOKE ALL ON FUNCTION public.get_proof_of_delivery_stats(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_proof_of_delivery_stats(INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_proof_of_delivery_stats(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_delivery_proofs(_limit INT DEFAULT 50, _offset INT DEFAULT 0, _only_skipped BOOLEAN DEFAULT false)
RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'delivered_at', o.delivered_at,
    'delivery_photo_url', o.delivery_photo_url,
    'delivery_photo_at', o.delivery_photo_at,
    'delivery_photo_lat', o.delivery_photo_lat,
    'delivery_photo_lng', o.delivery_photo_lng,
    'delivery_signature_url', o.delivery_signature_url,
    'delivery_proof_notes', o.delivery_proof_notes,
    'delivery_proof_skipped_reason', o.delivery_proof_skipped_reason,
    'delivery_contact_type', o.delivery_contact_type,
    'total', o.total,
    'courier_name', c.name
  )
  FROM public.orders o
  LEFT JOIN public.couriers c ON c.id = o.courier_id
  WHERE o.status = 'entregue'
    AND (NOT _only_skipped OR o.delivery_proof_skipped_reason IS NOT NULL)
  ORDER BY o.delivered_at DESC NULLS LAST
  LIMIT _limit OFFSET _offset;
END; $function$;

REVOKE ALL ON FUNCTION public.list_delivery_proofs(INT, INT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_delivery_proofs(INT, INT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_delivery_proofs(INT, INT, BOOLEAN) TO authenticated;
