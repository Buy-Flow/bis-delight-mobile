CREATE OR REPLACE FUNCTION public.get_tracking_by_token(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v JSONB;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  SELECT to_jsonb(t) INTO v FROM (
    SELECT o.id, o.status, o.mode, o.customer_name, o.total,
      o.eta_minutes, o.delivery_lat, o.delivery_lng, o.origin_lat, o.origin_lng,
      o.distance_km, o.created_at, o.paid_at, o.preparing_at, o.dispatched_at,
      o.picked_up_at, o.delivered_at, o.address, o.reference,
      c.id AS courier_id, c.name AS courier_name, c.phone AS courier_phone,
      c.vehicle AS courier_vehicle, c.avatar_url AS courier_avatar, c.rating AS courier_rating,
      c.current_lat AS courier_lat, c.current_lng AS courier_lng, c.heading AS courier_heading,
      c.location_updated_at AS courier_location_at
    FROM public.orders o
    LEFT JOIN public.couriers c ON c.id = o.courier_id
    WHERE o.tracking_token = _token
    LIMIT 1
  ) t;
  RETURN v;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_tracking_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tracking_by_token(TEXT) TO anon, authenticated;