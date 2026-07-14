/**
 * Delivery fee preview — SINGLE SOURCE OF TRUTH.
 *
 * Same formula used inside CheckoutSheet (see src/components/menu/CheckoutSheet.tsx),
 * exposed so the cart page can display a consistent value instead of the old
 * hardcoded BRAND.deliveryFee.
 *
 * Priority:
 *   1. Free-delivery threshold reached  → fee = 0, kind = "free"
 *   2. Zone disabled                    → fee = flatFee, kind = "flat"
 *   3. Zone enabled + geocoded address  → exact fee via calcDeliveryFee, kind = "exact"
 *      (outside radius → fee = 0, kind = "outside")
 *   4. Zone enabled, no address yet     → cheapest possible fee, kind = "estimate"
 */

import {
  calcDeliveryFee,
  haversineKm,
  isWithinRadius,
  type DeliveryZoneConfig,
} from "@/lib/delivery-zone";

export type DeliveryPreviewKind = "free" | "flat" | "exact" | "estimate" | "outside";

export type DeliveryPreview = {
  /** Fee to charge (BRL, rounded 2dp). Always safe to add to subtotal. */
  fee: number;
  /** Kind of quote for UI labelling. */
  kind: DeliveryPreviewKind;
  /** True when fee is a lower-bound estimate and may increase on checkout. */
  isEstimate: boolean;
  /** Human label to show below the fee (e.g. "a partir de", "grátis"). */
  hint: string | null;
  /** Amount missing to unlock free delivery, or 0/null when unavailable. */
  missingForFree: number | null;
  /** Distance in km when computed from an address. */
  km: number | null;
};

export type DeliveryPreviewInput = {
  subtotal: number;
  /** Flat fee fallback (usually settings.deliveryFee). */
  flatFee: number;
  /** Order total above which delivery becomes free (0/undefined disables). */
  freeThreshold?: number | null;
  /** Distance-zone config (from settings.deliveryZone). */
  zone?: DeliveryZoneConfig | null;
  /** Store coordinates (from settings.storeLat/storeLng). */
  storeLat?: number | null;
  storeLng?: number | null;
  /** Selected address coordinates, when available. */
  addressLat?: number | null;
  addressLng?: number | null;
  /** Fulfilment mode — only "entrega" charges delivery. */
  mode?: "entrega" | "retirada";
};

/** Cheapest positive fee achievable in this zone — used as "a partir de". */
function cheapestZoneFee(zone: DeliveryZoneConfig, flatFee: number): number {
  if (!zone.enabled) return Math.max(0, flatFee);
  if (zone.pricingMode === "tiers") {
    const sorted = [...zone.tiers].sort((a, b) => a.upToKm - b.upToKm);
    const first = sorted[0];
    const base = first ? first.fee : flatFee;
    return Math.max(zone.minFee || 0, base, 0);
  }
  // linear: fee at 0km = baseFee (+ perKm * 0), floored by minFee
  const base = zone.baseFee;
  return Math.max(zone.minFee || 0, base, 0);
}

export function computeDeliveryPreview(input: DeliveryPreviewInput): DeliveryPreview {
  const mode = input.mode ?? "entrega";
  if (mode === "retirada") {
    return { fee: 0, kind: "flat", isEstimate: false, hint: "retirada", missingForFree: null, km: null };
  }

  const subtotal = Math.max(0, input.subtotal);
  const flatFee = Math.max(0, input.flatFee || 0);
  const threshold = input.freeThreshold && input.freeThreshold > 0 ? input.freeThreshold : 0;

  // 1. Free delivery unlocked?
  if (threshold > 0 && subtotal >= threshold) {
    return { fee: 0, kind: "free", isEstimate: false, hint: "grátis", missingForFree: 0, km: null };
  }
  const missingForFree = threshold > 0 ? Math.max(0, threshold - subtotal) : null;

  const zoneActive = Boolean(input.zone?.enabled);

  // 2. Zone disabled → flat fee
  if (!zoneActive || !input.zone) {
    return {
      fee: Math.round(flatFee * 100) / 100,
      kind: "flat",
      isEstimate: false,
      hint: null,
      missingForFree,
      km: null,
    };
  }

  const zone = input.zone;
  const hasStore =
    input.storeLat != null && input.storeLng != null &&
    Number.isFinite(input.storeLat) && Number.isFinite(input.storeLng);
  const hasAddress =
    input.addressLat != null && input.addressLng != null &&
    Number.isFinite(input.addressLat) && Number.isFinite(input.addressLng);

  // 3. Exact quote when we have both endpoints
  if (hasStore && hasAddress) {
    const km = haversineKm(
      { lat: input.storeLat as number, lng: input.storeLng as number },
      { lat: input.addressLat as number, lng: input.addressLng as number },
    );
    if (!isWithinRadius(km, zone)) {
      return { fee: 0, kind: "outside", isEstimate: false, hint: "fora do raio", missingForFree, km };
    }
    const fee = calcDeliveryFee(km, zone, flatFee);
    return { fee, kind: "exact", isEstimate: false, hint: null, missingForFree, km };
  }

  // 4. No address yet → cheapest possible fee
  const cheapest = Math.round(cheapestZoneFee(zone, flatFee) * 100) / 100;
  return {
    fee: cheapest,
    kind: "estimate",
    isEstimate: true,
    hint: "a partir de",
    missingForFree,
    km: null,
  };
}
