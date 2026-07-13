
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS current_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS current_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS heading NUMERIC,
  ADD COLUMN IF NOT EXISTS speed NUMERIC,
  ADD COLUMN IF NOT EXISTS accuracy NUMERIC,
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_deliveries INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_concurrent INTEGER NOT NULL DEFAULT 3;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='couriers_status_check') THEN
    ALTER TABLE public.couriers ADD CONSTRAINT couriers_status_check CHECK (status IN ('offline','online','busy','pause'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_couriers_user_id ON public.couriers(user_id);
CREATE INDEX IF NOT EXISTS idx_couriers_status ON public.couriers(status);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS eta_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS origin_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS origin_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS customer_rating INTEGER,
  ADD COLUMN IF NOT EXISTS courier_rating INTEGER,
  ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.set_tracking_token()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tracking_token IS NULL THEN
    NEW.tracking_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_tracking_token ON public.orders;
CREATE TRIGGER trg_set_tracking_token BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_tracking_token();
UPDATE public.orders SET tracking_token = encode(gen_random_bytes(16),'hex') WHERE tracking_token IS NULL;

CREATE TABLE IF NOT EXISTS public.courier_locations (
  id BIGSERIAL PRIMARY KEY,
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  lat NUMERIC NOT NULL, lng NUMERIC NOT NULL,
  heading NUMERIC, speed NUMERIC, accuracy NUMERIC, battery INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courier_locations_courier ON public.courier_locations(courier_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_courier_locations_order ON public.courier_locations(order_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.courier_locations TO authenticated;
GRANT SELECT ON public.courier_locations TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.courier_locations_id_seq TO authenticated;
GRANT ALL ON public.courier_locations TO service_role;
GRANT ALL ON SEQUENCE public.courier_locations_id_seq TO service_role;
ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.delivery_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_id UUID REFERENCES public.couriers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired','cancelled')),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 seconds'),
  broadcast BOOLEAN NOT NULL DEFAULT true,
  fee NUMERIC(10,2), distance_km NUMERIC, note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_order ON public.delivery_offers(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_courier ON public.delivery_offers(courier_id, status);
GRANT SELECT, INSERT, UPDATE ON public.delivery_offers TO authenticated;
GRANT ALL ON public.delivery_offers TO service_role;
ALTER TABLE public.delivery_offers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_courier_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.couriers WHERE user_id = auth.uid() LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.current_courier_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_courier_id() TO authenticated;

DROP POLICY IF EXISTS "Courier reads self" ON public.couriers;
CREATE POLICY "Courier reads self" ON public.couriers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Courier updates self" ON public.couriers;
CREATE POLICY "Courier updates self" ON public.couriers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Courier writes own location" ON public.courier_locations;
CREATE POLICY "Courier writes own location" ON public.courier_locations FOR INSERT TO authenticated
  WITH CHECK (courier_id = public.current_courier_id() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admin reads all locations" ON public.courier_locations;
CREATE POLICY "Admin reads all locations" ON public.courier_locations FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR courier_id = public.current_courier_id());
DROP POLICY IF EXISTS "Public reads locations by order" ON public.courier_locations;
CREATE POLICY "Public reads locations by order" ON public.courier_locations FOR SELECT TO anon
  USING (order_id IS NOT NULL);

DROP POLICY IF EXISTS "Admin manages offers" ON public.delivery_offers;
CREATE POLICY "Admin manages offers" ON public.delivery_offers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Courier reads own offers" ON public.delivery_offers;
CREATE POLICY "Courier reads own offers" ON public.delivery_offers FOR SELECT TO authenticated
  USING (courier_id = public.current_courier_id()
         OR (broadcast = true AND status = 'pending' AND public.current_courier_id() IS NOT NULL));
DROP POLICY IF EXISTS "Courier responds to offers" ON public.delivery_offers;
CREATE POLICY "Courier responds to offers" ON public.delivery_offers FOR UPDATE TO authenticated
  USING (status='pending' AND (courier_id = public.current_courier_id()
         OR (broadcast=true AND public.current_courier_id() IS NOT NULL)))
  WITH CHECK (public.current_courier_id() IS NOT NULL);

DROP POLICY IF EXISTS "Courier reads assigned orders" ON public.orders;
CREATE POLICY "Courier reads assigned orders" ON public.orders FOR SELECT TO authenticated
  USING (courier_id = public.current_courier_id());
DROP POLICY IF EXISTS "Courier updates assigned orders" ON public.orders;
CREATE POLICY "Courier updates assigned orders" ON public.orders FOR UPDATE TO authenticated
  USING (courier_id = public.current_courier_id())
  WITH CHECK (courier_id = public.current_courier_id());

DROP VIEW IF EXISTS public.order_tracking_public CASCADE;
CREATE VIEW public.order_tracking_public WITH (security_invoker = on) AS
SELECT o.id, o.tracking_token, o.status, o.mode, o.customer_name, o.total,
  o.eta_minutes, o.delivery_lat, o.delivery_lng, o.origin_lat, o.origin_lng,
  o.distance_km, o.created_at, o.paid_at, o.preparing_at, o.dispatched_at,
  o.picked_up_at, o.delivered_at, o.address, o.reference,
  c.id AS courier_id, c.name AS courier_name, c.phone AS courier_phone,
  c.vehicle AS courier_vehicle, c.avatar_url AS courier_avatar, c.rating AS courier_rating,
  c.current_lat AS courier_lat, c.current_lng AS courier_lng, c.heading AS courier_heading,
  c.location_updated_at AS courier_location_at
FROM public.orders o LEFT JOIN public.couriers c ON c.id = o.courier_id;
GRANT SELECT ON public.order_tracking_public TO anon, authenticated;

DROP VIEW IF EXISTS public.couriers_live CASCADE;
CREATE VIEW public.couriers_live WITH (security_invoker = on) AS
SELECT id, name, phone, vehicle, plate, avatar_url, status,
  current_lat, current_lng, heading, speed, accuracy,
  location_updated_at, last_seen_at, total_deliveries, rating, active
FROM public.couriers;
GRANT SELECT ON public.couriers_live TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_delivery_offer(_offer_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_courier UUID; v_order UUID; v_status TEXT; v_existing UUID;
BEGIN
  v_courier := public.current_courier_id();
  IF v_courier IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_courier'); END IF;
  SELECT order_id, status INTO v_order, v_status FROM public.delivery_offers WHERE id = _offer_id FOR UPDATE;
  IF v_order IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'offer_not_found'); END IF;
  IF v_status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'offer_taken'); END IF;
  SELECT courier_id INTO v_existing FROM public.orders WHERE id = v_order FOR UPDATE;
  IF v_existing IS NOT NULL AND v_existing <> v_courier THEN
    UPDATE public.delivery_offers SET status='cancelled', responded_at=now() WHERE id = _offer_id;
    RETURN jsonb_build_object('ok', false, 'error', 'already_assigned');
  END IF;
  UPDATE public.delivery_offers SET status='accepted', courier_id = v_courier, responded_at = now() WHERE id = _offer_id;
  UPDATE public.delivery_offers SET status='cancelled', responded_at = now()
    WHERE order_id = v_order AND id <> _offer_id AND status = 'pending';
  UPDATE public.orders
    SET courier_id = v_courier,
        status = CASE WHEN status IN ('pago','preparando') THEN status ELSE 'saiu_para_entrega' END,
        dispatched_at = COALESCE(dispatched_at, now())
    WHERE id = v_order;
  UPDATE public.couriers SET status='busy' WHERE id = v_courier;
  RETURN jsonb_build_object('ok', true, 'order_id', v_order);
END; $$;
REVOKE EXECUTE ON FUNCTION public.accept_delivery_offer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_delivery_offer(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_delivery_offer(_offer_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_courier UUID;
BEGIN
  v_courier := public.current_courier_id();
  IF v_courier IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_courier'); END IF;
  UPDATE public.delivery_offers SET status='rejected', responded_at=now(), courier_id = COALESCE(courier_id, v_courier)
    WHERE id = _offer_id AND status='pending';
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.reject_delivery_offer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_delivery_offer(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_delivery(_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_courier UUID; v_fee NUMERIC;
BEGIN
  v_courier := public.current_courier_id();
  IF v_courier IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_courier'); END IF;
  UPDATE public.orders SET status='entregue', delivered_at = now()
    WHERE id = _order_id AND courier_id = v_courier
    RETURNING delivery_fee INTO v_fee;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'order_not_found'); END IF;
  UPDATE public.couriers
    SET total_deliveries = total_deliveries + 1,
        total_earnings = total_earnings + COALESCE(v_fee, 0),
        status = CASE WHEN (SELECT COUNT(*) FROM public.orders WHERE courier_id = v_courier AND status IN ('saiu_para_entrega','preparando','pago')) = 0 THEN 'online' ELSE 'busy' END
    WHERE id = v_courier;
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.complete_delivery(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_delivery(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.pickup_delivery(_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_courier UUID;
BEGIN
  v_courier := public.current_courier_id();
  IF v_courier IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_courier'); END IF;
  UPDATE public.orders SET picked_up_at = now(),
    status = CASE WHEN status <> 'entregue' THEN 'saiu_para_entrega' ELSE status END
    WHERE id = _order_id AND courier_id = v_courier;
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.pickup_delivery(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pickup_delivery(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.courier_heartbeat(
  _lat NUMERIC, _lng NUMERIC, _heading NUMERIC DEFAULT NULL,
  _speed NUMERIC DEFAULT NULL, _accuracy NUMERIC DEFAULT NULL, _battery INTEGER DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_courier UUID; v_active_order UUID;
BEGIN
  v_courier := public.current_courier_id();
  IF v_courier IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_courier'); END IF;
  UPDATE public.couriers
    SET current_lat = _lat, current_lng = _lng,
        heading = _heading, speed = _speed, accuracy = _accuracy,
        location_updated_at = now(), last_seen_at = now()
    WHERE id = v_courier;
  SELECT id INTO v_active_order FROM public.orders
    WHERE courier_id = v_courier AND status IN ('saiu_para_entrega','preparando','pago')
    ORDER BY dispatched_at DESC NULLS LAST LIMIT 1;
  INSERT INTO public.courier_locations(courier_id, order_id, lat, lng, heading, speed, accuracy, battery)
    VALUES (v_courier, v_active_order, _lat, _lng, _heading, _speed, _accuracy, _battery);
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.courier_heartbeat(NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.courier_heartbeat(NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_courier_status(_status TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_courier UUID;
BEGIN
  IF _status NOT IN ('online','offline','pause') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_status'); END IF;
  v_courier := public.current_courier_id();
  IF v_courier IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_courier'); END IF;
  UPDATE public.couriers SET status = _status, last_seen_at = now() WHERE id = v_courier;
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_courier_status(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_courier_status(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.broadcast_delivery_offer(_order_id UUID, _fee NUMERIC DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_distance NUMERIC;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  SELECT distance_km INTO v_distance FROM public.orders WHERE id = _order_id;
  INSERT INTO public.delivery_offers(order_id, broadcast, fee, distance_km, status)
    VALUES (_order_id, true, _fee, v_distance, 'pending') RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'offer_id', v_id);
END; $$;
REVOKE EXECUTE ON FUNCTION public.broadcast_delivery_offer(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_delivery_offer(UUID, NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.link_courier_to_user(_courier_id UUID, _user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  UPDATE public.couriers SET user_id = _user_id WHERE id = _courier_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, 'delivery') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.link_courier_to_user(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_courier_to_user(UUID, UUID) TO authenticated;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.couriers; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_locations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_offers; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
