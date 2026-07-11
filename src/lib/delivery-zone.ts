/**
 * Delivery zone: distance-based freight config, geocoding and fee calculation.
 * Kept framework-agnostic so both admin (editor) and menu (checkout) can share it.
 */

export type DeliveryTier = {
  /** Upper bound (inclusive) of this tier, in kilometers from the store. */
  upToKm: number;
  /** Flat fee (BRL) charged when distance <= upToKm. */
  fee: number;
};

export type DeliveryPricingMode = "linear" | "tiers";

export type DeliveryZoneConfig = {
  /** When false, checkout falls back to the flat `deliveryFee` setting. */
  enabled: boolean;
  /** Max delivery radius in km. 0 = no limit. */
  maxKm: number;
  /** Pricing strategy. */
  pricingMode: DeliveryPricingMode;
  /** Linear mode: base fee added regardless of distance. */
  baseFee: number;
  /** Linear mode: additional fee per km. */
  perKm: number;
  /** Floor applied to computed fee (0 = no floor). */
  minFee: number;
  /** Ceiling applied to computed fee (0 = no cap). */
  maxFee: number;
  /** Distance tiers (used when pricingMode === "tiers"). */
  tiers: DeliveryTier[];
  /** Message shown when address is outside the max radius. */
  outsideMessage: string;
};

export const DEFAULT_DELIVERY_ZONE: DeliveryZoneConfig = {
  enabled: false,
  maxKm: 10,
  pricingMode: "tiers",
  baseFee: 3,
  perKm: 1.5,
  minFee: 3,
  maxFee: 0,
  tiers: [
    { upToKm: 2, fee: 4 },
    { upToKm: 4, fee: 6 },
    { upToKm: 7, fee: 9 },
    { upToKm: 10, fee: 14 },
  ],
  outsideMessage:
    "Que pena! Seu endereço está fora do nosso raio de entrega. Você pode escolher retirada na loja.",
};

/** Parse an unknown value (e.g. jsonb from Supabase) into a valid DeliveryZoneConfig. */
export function parseDeliveryZone(raw: unknown): DeliveryZoneConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_DELIVERY_ZONE;
  const r = raw as Partial<DeliveryZoneConfig>;
  const tiers = Array.isArray(r.tiers)
    ? (r.tiers as DeliveryTier[])
        .filter((t) => t && Number.isFinite(t.upToKm) && Number.isFinite(t.fee))
        .map((t) => ({ upToKm: Number(t.upToKm), fee: Number(t.fee) }))
        .sort((a, b) => a.upToKm - b.upToKm)
    : DEFAULT_DELIVERY_ZONE.tiers;
  return {
    enabled: Boolean(r.enabled ?? DEFAULT_DELIVERY_ZONE.enabled),
    maxKm: Number.isFinite(r.maxKm as number) ? Number(r.maxKm) : DEFAULT_DELIVERY_ZONE.maxKm,
    pricingMode: r.pricingMode === "linear" ? "linear" : "tiers",
    baseFee: Number.isFinite(r.baseFee as number) ? Number(r.baseFee) : DEFAULT_DELIVERY_ZONE.baseFee,
    perKm: Number.isFinite(r.perKm as number) ? Number(r.perKm) : DEFAULT_DELIVERY_ZONE.perKm,
    minFee: Number.isFinite(r.minFee as number) ? Number(r.minFee) : DEFAULT_DELIVERY_ZONE.minFee,
    maxFee: Number.isFinite(r.maxFee as number) ? Number(r.maxFee) : DEFAULT_DELIVERY_ZONE.maxFee,
    tiers,
    outsideMessage: typeof r.outsideMessage === "string" && r.outsideMessage
      ? r.outsideMessage
      : DEFAULT_DELIVERY_ZONE.outsideMessage,
  };
}

/** Haversine great-circle distance in kilometers between two points. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compute delivery fee (BRL) for a given distance under a zone config. */
export function calcDeliveryFee(
  km: number,
  cfg: DeliveryZoneConfig,
  fallbackFlatFee: number,
): number {
  if (!cfg.enabled) return fallbackFlatFee;
  let fee: number;
  if (cfg.pricingMode === "tiers") {
    const sorted = [...cfg.tiers].sort((a, b) => a.upToKm - b.upToKm);
    const tier = sorted.find((t) => km <= t.upToKm);
    fee = tier ? tier.fee : (sorted.at(-1)?.fee ?? fallbackFlatFee);
  } else {
    fee = cfg.baseFee + cfg.perKm * km;
  }
  if (cfg.minFee > 0) fee = Math.max(cfg.minFee, fee);
  if (cfg.maxFee > 0) fee = Math.min(cfg.maxFee, fee);
  fee = Math.max(0, fee);
  return Math.round(fee * 100) / 100;
}

/** Is `km` within the zone's max delivery radius? */
export function isWithinRadius(km: number, cfg: DeliveryZoneConfig): boolean {
  if (!cfg.enabled) return true;
  if (!cfg.maxKm || cfg.maxKm <= 0) return true;
  return km <= cfg.maxKm + 0.05; // 50m tolerance
}

export type GeocodeResult = { lat: number; lng: number; label: string };

/**
 * Geocode a Brazilian address string using OpenStreetMap Nominatim.
 * Free service — respect ~1 req/sec (caller should debounce).
 */
export async function geocodeAddress(
  query: string,
  opts?: { city?: string; signal?: AbortSignal },
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (trimmed.length < 4) return null;
  const parts = [trimmed];
  if (opts?.city && !trimmed.toLowerCase().includes(opts.city.toLowerCase())) {
    parts.push(opts.city);
  }
  parts.push("Brasil");
  const q = parts.join(", ");
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=0&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: { "Accept-Language": "pt-BR" },
      signal: opts?.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: data[0].display_name };
  } catch {
    return null;
  }
}

/** Reverse geocode: coords -> human-readable address. */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url, {
      headers: { "Accept-Language": "pt-BR" },
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}
