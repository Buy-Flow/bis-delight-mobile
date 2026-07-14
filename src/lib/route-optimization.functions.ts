import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Route optimization for couriers.
 *
 * Given a courier and their active orders (or an explicit list of order IDs),
 * compute the optimal delivery order using Google Routes API's
 * `optimizeWaypointOrder`, falling back to a nearest-neighbor heuristic when
 * disabled or when the gateway call fails.
 */

const InputSchema = z.object({
  courier_id: z.string().uuid().optional(),
  order_ids: z.array(z.string().uuid()).max(20).optional(),
  // Optional override — when caller wants to force store as origin.
  origin: z.object({ lat: z.number(), lng: z.number() }).optional(),
  // Persist result to route_optimizations table.
  save: z.boolean().default(true),
  // Force a specific provider (admin simulation).
  force_provider: z.enum(["google_directions", "nearest_neighbor"]).optional(),
});

export type OptimizedStop = {
  order_id: string;
  customer_name: string | null;
  address: string | null;
  lat: number;
  lng: number;
  distance_from_prev_km: number | null;
  duration_from_prev_min: number | null;
  eta_at: string | null; // ISO
  cumulative_km: number;
  cumulative_min: number;
};

export type OptimizeResult = {
  ok: boolean;
  error?: string;
  provider_used: "google_directions" | "nearest_neighbor";
  origin: { lat: number; lng: number };
  return_to_store: boolean;
  total_distance_km: number;
  total_duration_min: number;
  naive_distance_km: number;
  saved_km: number;
  saved_min: number;
  encoded_polyline: string | null;
  stops: OptimizedStop[];
  history_id: string | null;
};

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

type OrderRow = {
  id: string;
  customer_name: string | null;
  address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  status: string;
};

async function assertAllowed(context: {
  supabase: any;
  userId: string;
}, courierId: string | undefined) {
  const { data: admin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (admin) return { admin: true, courierId };
  // Courier can only optimize their own routes.
  const { data: courier } = await context.supabase
    .from("couriers")
    .select("id, user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!courier) throw new Error("Acesso negado");
  if (courierId && courier.id !== courierId) throw new Error("Acesso negado");
  return { admin: false, courierId: courier.id };
}

function nearestNeighborOrder(
  origin: { lat: number; lng: number },
  points: Array<{ lat: number; lng: number; id: string }>,
): string[] {
  const remaining = [...points];
  const path: string[] = [];
  let current = origin;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    path.push(chosen.id);
    current = chosen;
  }
  return path;
}

function totalHaversine(
  origin: { lat: number; lng: number },
  ordered: Array<{ lat: number; lng: number }>,
  end: { lat: number; lng: number } | null,
) {
  let sum = 0;
  let prev = origin;
  for (const p of ordered) {
    sum += haversine(prev, p);
    prev = p;
  }
  if (end) sum += haversine(prev, end);
  return sum;
}

export const optimizeRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => InputSchema.parse(raw))
  .handler(async ({ data, context }): Promise<OptimizeResult> => {
    const allowed = await assertAllowed(context, data.courier_id);
    const courierId = allowed.courierId ?? data.courier_id ?? null;

    // Load settings
    const { data: settings } = await context.supabase
      .from("route_optimization_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    const cfg = settings ?? {
      enabled: true,
      min_stops: 2,
      max_stops: 8,
      provider: "google_directions",
      travel_mode: "TWO_WHEELER",
      traffic_mode: "TRAFFIC_AWARE",
      avoid_tolls: false,
      avoid_highways: false,
      avoid_ferries: true,
      return_to_store: true,
      extra_time_per_stop_min: 3,
    };

    // Origin: courier's current location if available; else store.
    let origin: { lat: number; lng: number } | null = data.origin ?? null;

    if (!origin && courierId) {
      const { data: c } = await context.supabase
        .from("couriers")
        .select("current_lat, current_lng")
        .eq("id", courierId)
        .maybeSingle();
      if (c?.current_lat && c?.current_lng) {
        origin = { lat: Number(c.current_lat), lng: Number(c.current_lng) };
      }
    }

    const { data: site } = await context.supabase
      .from("site_settings")
      .select("store_lat, store_lng")
      .maybeSingle();
    const storeOrigin =
      site?.store_lat && site?.store_lng
        ? { lat: Number(site.store_lat), lng: Number(site.store_lng) }
        : null;

    if (!origin) origin = storeOrigin;
    if (!origin) throw new Error("Origem indisponível — configure a localização da loja em Configurações.");

    // Load orders
    let query = context.supabase
      .from("orders")
      .select("id, customer_name, address, delivery_lat, delivery_lng, status");

    if (data.order_ids && data.order_ids.length > 0) {
      query = query.in("id", data.order_ids);
    } else if (courierId) {
      query = query
        .eq("courier_id", courierId)
        .in("status", ["pago", "preparando", "saiu_para_entrega"]);
    } else {
      throw new Error("Informe courier_id ou order_ids");
    }
    const { data: orders } = await query;
    const rows = (orders ?? []) as OrderRow[];
    const usable = rows.filter(
      (o) => o.delivery_lat != null && o.delivery_lng != null,
    );

    if (usable.length < 1) throw new Error("Nenhum pedido com coordenadas disponível.");
    if (usable.length > cfg.max_stops)
      throw new Error(`Máximo de ${cfg.max_stops} paradas por rota.`);

    const points = usable.map((o) => ({
      id: o.id,
      lat: Number(o.delivery_lat),
      lng: Number(o.delivery_lng),
    }));

    // Naive baseline (input order, no optimization)
    const naiveDistance = totalHaversine(
      origin,
      points,
      cfg.return_to_store ? storeOrigin : null,
    );

    const forced = data.force_provider ?? cfg.provider;

    let providerUsed: "google_directions" | "nearest_neighbor" = "nearest_neighbor";
    let sequenceIds: string[] = [];
    let legDistanceMeters: number[] = [];
    let legDurationSeconds: number[] = [];
    let encodedPolyline: string | null = null;

    const tryGoogle = forced === "google_directions";

    if (tryGoogle) {
      try {
        const gwKey = process.env.LOVABLE_API_KEY;
        const providerKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!gwKey || !providerKey) throw new Error("missing_gateway_creds");

        const destination = cfg.return_to_store && storeOrigin ? storeOrigin : points[points.length - 1];
        const intermediates = cfg.return_to_store
          ? points
          : points.slice(0, -1);

        const body = {
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
          intermediates: intermediates.map((p) => ({
            location: { latLng: { latitude: p.lat, longitude: p.lng } },
          })),
          travelMode: cfg.travel_mode,
          routingPreference: cfg.travel_mode === "DRIVE" ? cfg.traffic_mode : undefined,
          optimizeWaypointOrder: true,
          routeModifiers: {
            avoidTolls: !!cfg.avoid_tolls,
            avoidHighways: !!cfg.avoid_highways,
            avoidFerries: !!cfg.avoid_ferries,
          },
          languageCode: "pt-BR",
          units: "METRIC",
        };

        const resp = await fetch(
          "https://connector-gateway.lovable.dev/google_maps/routes/directions/v2:computeRoutes",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${gwKey}`,
              "X-Connection-Api-Key": providerKey,
              "Content-Type": "application/json",
              "X-Goog-FieldMask":
                "routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration",
            },
            body: JSON.stringify(body),
          },
        );
        if (!resp.ok) {
          const txt = await resp.text();
          console.error("Routes API failed", resp.status, txt);
          throw new Error(`routes_api_${resp.status}`);
        }
        const json = await resp.json();
        const route = json?.routes?.[0];
        if (!route) throw new Error("no_route");

        const optOrder: number[] = route.optimizedIntermediateWaypointIndex ?? intermediates.map((_: unknown, i: number) => i);

        // Rebuild the full sequence of order IDs including the final drop (when not return_to_store)
        const orderedIntermediateIds = optOrder.map((i: number) => intermediates[i].id);
        sequenceIds = cfg.return_to_store
          ? orderedIntermediateIds
          : [...orderedIntermediateIds, points[points.length - 1].id];

        // Legs: origin→stop1, stop1→stop2, ..., lastStop→destination
        const legs = (route.legs ?? []) as Array<{
          distanceMeters?: number;
          duration?: string;
        }>;
        legDistanceMeters = legs.map((l) => l.distanceMeters ?? 0);
        legDurationSeconds = legs.map((l) => parseGoogleDuration(l.duration));
        encodedPolyline = route.polyline?.encodedPolyline ?? null;
        providerUsed = "google_directions";
      } catch (err) {
        console.warn("[route-optimize] falling back to nearest_neighbor:", err);
        providerUsed = "nearest_neighbor";
      }
    }

    if (providerUsed !== "google_directions") {
      // Nearest-neighbor
      sequenceIds = nearestNeighborOrder(origin, points);
    }

    // Build stops output
    const pointById = new Map(points.map((p) => [p.id, p]));
    const rowById = new Map(usable.map((r) => [r.id, r]));

    const stops: OptimizedStop[] = [];
    let cumKm = 0;
    let cumMin = 0;
    const startMs = Date.now();

    for (let i = 0; i < sequenceIds.length; i++) {
      const id = sequenceIds[i];
      const p = pointById.get(id)!;
      const row = rowById.get(id)!;

      let legKm: number | null = null;
      let legMin: number | null = null;

      if (providerUsed === "google_directions" && legDistanceMeters[i] != null) {
        legKm = legDistanceMeters[i] / 1000;
        legMin = legDurationSeconds[i] / 60;
      } else {
        const prev = i === 0 ? origin : pointById.get(sequenceIds[i - 1])!;
        legKm = haversine(prev, p);
        // Rough estimate: 25 km/h average (urban delivery on scooter)
        legMin = (legKm / 25) * 60;
      }

      cumKm += legKm;
      cumMin += legMin + cfg.extra_time_per_stop_min;
      stops.push({
        order_id: id,
        customer_name: row.customer_name,
        address: row.address,
        lat: p.lat,
        lng: p.lng,
        distance_from_prev_km: Number(legKm.toFixed(2)),
        duration_from_prev_min: Number(legMin.toFixed(1)),
        eta_at: new Date(startMs + cumMin * 60000).toISOString(),
        cumulative_km: Number(cumKm.toFixed(2)),
        cumulative_min: Number(cumMin.toFixed(1)),
      });
    }

    // Final return leg (if enabled), add to totals but don't show as stop
    let totalKm = cumKm;
    let totalMin = cumMin;
    if (cfg.return_to_store && storeOrigin) {
      if (providerUsed === "google_directions" && legDistanceMeters[sequenceIds.length] != null) {
        totalKm += legDistanceMeters[sequenceIds.length] / 1000;
        totalMin += legDurationSeconds[sequenceIds.length] / 60;
      } else if (sequenceIds.length > 0) {
        const last = pointById.get(sequenceIds[sequenceIds.length - 1])!;
        const rk = haversine(last, storeOrigin);
        totalKm += rk;
        totalMin += (rk / 25) * 60;
      }
    }

    const savedKm = Math.max(0, naiveDistance - totalKm);
    const savedMin = savedKm > 0 ? (savedKm / 25) * 60 : 0;

    let historyId: string | null = null;
    if (data.save && courierId) {
      const { data: ins } = await context.supabase
        .from("route_optimizations")
        .insert({
          courier_id: courierId,
          order_ids: usable.map((o) => o.id),
          sequence: sequenceIds,
          total_distance_km: Number(totalKm.toFixed(2)),
          total_duration_min: Number(totalMin.toFixed(1)),
          naive_distance_km: Number(naiveDistance.toFixed(2)),
          saved_km: Number(savedKm.toFixed(2)),
          saved_min: Number(savedMin.toFixed(1)),
          encoded_polyline: encodedPolyline,
          legs: stops as unknown as Record<string, unknown>[],
          origin_lat: origin.lat,
          origin_lng: origin.lng,
          provider_used: providerUsed,
          return_to_store: !!cfg.return_to_store,
        })
        .select("id")
        .single();
      historyId = ins?.id ?? null;
    }

    return {
      ok: true,
      provider_used: providerUsed,
      origin,
      return_to_store: !!cfg.return_to_store,
      total_distance_km: Number(totalKm.toFixed(2)),
      total_duration_min: Number(totalMin.toFixed(1)),
      naive_distance_km: Number(naiveDistance.toFixed(2)),
      saved_km: Number(savedKm.toFixed(2)),
      saved_min: Number(savedMin.toFixed(1)),
      encoded_polyline: encodedPolyline,
      stops,
      history_id: historyId,
    };
  });

function parseGoogleDuration(dur?: string): number {
  // "123s" style
  if (!dur) return 0;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(dur);
  return m ? parseFloat(m[1]) : 0;
}
