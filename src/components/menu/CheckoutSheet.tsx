import { useEffect, useRef, useState } from "react";
import { X, Truck, Store, Sparkles, LogIn, Loader2, User, Phone, MapPin, Settings, MessageCircle, Heart, Plus, Minus, ShoppingBag, Ticket, Check, Route, AlertTriangle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { brl, useCart, type CartItem } from "@/lib/cart-context";
import { BRAND } from "@/data/menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useBackDismiss } from "@/lib/use-back-dismiss";
import { logSilent } from "@/lib/silent-errors";
import { CheckoutUpsellStrip } from "@/components/menu/CheckoutUpsellStrip";
import { FreeDeliveryBar } from "@/components/menu/FreeDeliveryBar";
import { useStoreStatus, STORE_COPY } from "@/lib/store-status";
import { useSiteSettings } from "@/lib/menu-data";
import {
  calcDeliveryFee,
  geocodeAddress,
  haversineKm,
  isWithinRadius,
  reverseGeocode,
} from "@/lib/delivery-zone";
import { useUserAddresses, type UserAddress } from "@/lib/user-addresses";
import { AddressMapPicker } from "@/components/menu/AddressMapPicker";
import { AddressMapInline, type InlinePickedLocation } from "@/components/menu/AddressMapInline";
import { MoonStar, Clock as ClockIcon, Home, Briefcase, Star, Navigation, Mail, QrCode, CreditCard, MessageCircle as WhatsIcon, Lock, ShieldCheck, ChevronDown } from "lucide-react";
import { formatCpf, cpfDigits, isValidCpf } from "@/lib/cpf";
import { maskPhoneInput as formatPhone } from "@/lib/phone";
import { useServerFn } from "@tanstack/react-start";
import { createAsaasCardForOrder, createAsaasCheckoutForOrder } from "@/lib/asaas.functions";

function formatCardNumber(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 19);
  return d.replace(/(.{4})/g, "$1 ").trim();
}
function formatCardExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}
function formatCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
function detectCardBrand(num: string): string | null {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^(4011|4312|4389|4514|4573|5041|5066|5067|6277|6362|6363|6516|6550)/.test(n)) return "Elo";
  if (/^(606282|3841)/.test(n)) return "Hipercard";
  return null;
}


type Mode = "entrega" | "retirada";

const STORAGE_KEY = "querobis:customer";
const PAYMENT_REDIRECT_KEY = "querobis:payment_redirect_until";

type SavedCustomer = {
  name?: string;
  phone?: string;
  address?: string;
  reference?: string;
};

function loadSaved(): SavedCustomer {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (e) {
    logSilent("checkout:load-saved", e);
    return {};
  }
}



// Canonical delimiter between the "left" (street, number) and "right" (neighborhood, city)
// halves of a serialized address. We intentionally use an em-dash with spaces because "-" is
// common inside street names (e.g. "Rua Dr. José-Maria", "Av. Nossa Senhora - São Paulo") and
// splitting on "-" would corrupt them silently, sending malformed addresses to the courier.
const ADDR_DELIM = " — ";

function splitAddressHalves(s: string): [string, string] {
  const emIdx = s.indexOf("—");
  if (emIdx >= 0) return [s.slice(0, emIdx).trim(), s.slice(emIdx + 1).trim()];
  // Legacy fallback for addresses persisted with " - ": use the LAST occurrence so hyphenated
  // street names on the left half stay intact and the split lands between left/right halves.
  const lastDash = s.lastIndexOf(" - ");
  if (lastDash >= 0) return [s.slice(0, lastDash).trim(), s.slice(lastDash + 3).trim()];
  return [s.trim(), ""];
}

function parseAddressParts(full: string): { street: string; number: string; neighborhood: string; city: string } {
  const s = (full || "").trim();
  if (!s) return { street: "", number: "", neighborhood: "", city: "" };
  let [left, right] = splitAddressHalves(s);
  const leftParts = left.split(",").map((x) => x.trim()).filter(Boolean);
  let street = leftParts[0] ?? "";
  let number = "";
  if (leftParts[1] && /^\d/.test(leftParts[1])) number = leftParts[1];
  else if (leftParts[1]) street = `${street}, ${leftParts[1]}`;
  if (!right && leftParts.length > 2) right = leftParts.slice(2).join(", ");
  const rightParts = right.split(",").map((x) => x.trim()).filter(Boolean);
  return { street, number, neighborhood: rightParts[0] ?? "", city: rightParts.slice(1).join(", ") };
}

function joinAddressParts(p: { street: string; number: string; neighborhood: string; city: string }): string {
  const left = [p.street.trim(), p.number.trim()].filter(Boolean).join(", ");
  const right = [p.neighborhood.trim(), p.city.trim()].filter(Boolean).join(", ");
  if (left && right) return `${left}${ADDR_DELIM}${right}`;
  return left || right;
}


export function CheckoutSheet({ pageMode = false }: { pageMode?: boolean } = {}) {
  const { isCheckoutOpen, closeCheckout, items, update, subtotal, clear } = useCart();
  useBackDismiss(pageMode ? false : isCheckoutOpen, closeCheckout);
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const navigate = useNavigate();
  const storeStatus = useStoreStatus();

  const { data: settings } = useSiteSettings();
  const savedAddresses = useUserAddresses(user?.id);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [preGeocoded, setPreGeocoded] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  const [mode, setMode] = useState<Mode>("entrega");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrNumber, setAddrNumber] = useState("");
  const [addrNeighborhood, setAddrNeighborhood] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"whatsapp" | "pix" | "cartao" | "asaas_checkout">("pix");
  const [cardBillingOpen, setCardBillingOpen] = useState(false);
  const [cpf, setCpf] = useState("");
  const [cpfLocked, setCpfLocked] = useState(false);
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const [cardCep, setCardCep] = useState("");
  const [cardAddrNumber, setCardAddrNumber] = useState("");
  const [cardEmail, setCardEmail] = useState("");
  const [installments, setInstallments] = useState(1);
  const [savedCard, setSavedCard] = useState<{ last4: string; brand: string } | null>(null);
  const [useSavedCard, setUseSavedCard] = useState(true);
  const [saveCard, setSaveCard] = useState(true);
  const runCardCharge = useServerFn(createAsaasCardForOrder);
  const runAsaasCheckout = useServerFn(createAsaasCheckoutForOrder);
  const [couponInput, setCouponInput] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponApplied, setCouponApplied] = useState<{
    id: string;
    code: string;
    discount: number;
    kind: "loyalty" | "promo";
    minOrder: number;
    discountType?: "fixed" | "percent";
    discountValue?: number;
  } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<
    Array<{ id: string; code: string; discount: number; kind: "loyalty" | "promo"; label?: string; minOrder?: number }>
  >([]);

  // Load coupons the user already owns (loyalty) + active public promo coupons
  useEffect(() => {
    if ((!isCheckoutOpen && !pageMode) || !user) {
      setAvailableCoupons([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Only loyalty coupons are user-owned; promo coupons are not listable by regular users (RLS).
        const { data, error } = await supabase
          .from("loyalty_coupons")
          .select("id, code, discount_value, used_at, created_at")
          .eq("user_id", user.id)
          .is("used_at", null)
          .order("created_at", { ascending: false });
        if (cancelled) return;
        if (error) throw error;
        const list = (data || []).map((c: any) => {
          const v = Number(c.discount_value) > 0 ? Number(c.discount_value) : 20;
          return {
            id: c.id as string,
            code: c.code as string,
            discount: v,
            kind: "loyalty" as const,
            label: `Bis Recompensa · −${brl(v)}`,
            minOrder: v,
          };
        });
        setAvailableCoupons(list);
      } catch (e) {
        console.error("[coupons] load failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCheckoutOpen, pageMode, user, subtotal]);

  // Distance-based delivery quote
  const [quote, setQuote] = useState<{
    lat: number;
    lng: number;
    km: number;
    label: string;
  } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const geocodeReq = useRef(0);

  // Sync combined address <-> 4 parts when address changes externally
  useEffect(() => {
    const current = joinAddressParts({ street: addrStreet, number: addrNumber, neighborhood: addrNeighborhood, city: addrCity });
    if (current === address) return;
    const p = parseAddressParts(address);
    setAddrStreet(p.street);
    setAddrNumber(p.number);
    setAddrNeighborhood(p.neighborhood);
    setAddrCity(p.city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);



  // Hidrata identidade/endereço UMA vez por sessão (usuário) para não sobrescrever
  // o que o cliente digitou ao reabrir o modal. Guardas `!current` respeitam
  // edições em andamento; um ref garante que profile só é lido uma vez.
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isCheckoutOpen && !pageMode) return;
    const key = user?.id ?? "guest";
    if (hydratedFor.current === key) return;
    hydratedFor.current = key;

    const saved = loadSaved();
    if (saved.name && !name) setName(saved.name);
    if (saved.phone && !phone) setPhone(saved.phone);
    if (saved.address && !address) setAddress(saved.address);
    if (saved.reference && !reference) setReference(saved.reference);

    if (user) {
      supabase
        .from("profiles")
        .select("full_name, phone, address, reference, asaas_card_last4, asaas_card_brand, asaas_card_token")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          // Só preenche campos VAZIOS — nunca sobrescreve edição do cliente.
          if (data.full_name && !name) setName(data.full_name);
          if (data.phone && !phone) setPhone(data.phone);
          if (data.address && !address) setAddress(data.address);
          if (data.reference && !reference) setReference(data.reference);
          if (data.asaas_card_token && data.asaas_card_last4) {
            setSavedCard({ last4: String(data.asaas_card_last4), brand: String(data.asaas_card_brand || "Cartão") });
            setUseSavedCard(true);
          } else {
            setSavedCard(null);
            setUseSavedCard(false);
          }
        });
    } else {
      setSavedCard(null);
      setUseSavedCard(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckoutOpen, pageMode, user?.id]);


  const zone = settings?.deliveryZone;
  const originLat = settings?.storeLat ?? null;
  const originLng = settings?.storeLng ?? null;
  const zoneActive = !!(zone?.enabled && originLat != null && originLng != null);

  // Debounced geocode when address changes (delivery mode + zone active)
  useEffect(() => {
    if (!isCheckoutOpen) return;
    if (mode !== "entrega" || !zoneActive) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const trimmed = address.trim();
    if (trimmed.length < 6) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    // Skip geocode if this address came pre-geocoded from a saved address
    if (preGeocoded && preGeocoded.address === trimmed && originLat != null && originLng != null) {
      const km = haversineKm({ lat: originLat, lng: originLng }, { lat: preGeocoded.lat, lng: preGeocoded.lng });
      setQuote({ lat: preGeocoded.lat, lng: preGeocoded.lng, km, label: trimmed });
      setQuoteError(null);
      setQuoting(false);
      return;
    }
    const reqId = ++geocodeReq.current;
    setQuoting(true);
    setQuoteError(null);
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const g = await geocodeAddress(trimmed, {
          city: settings?.city,
          signal: ctrl.signal,
        });
        if (reqId !== geocodeReq.current) return;
        if (!g) {
          setQuote(null);
          setQuoteError("Não consegui localizar esse endereço. Tente incluir bairro e número.");
        } else {
          const km = haversineKm({ lat: originLat!, lng: originLng! }, { lat: g.lat, lng: g.lng });
          setQuote({ lat: g.lat, lng: g.lng, km, label: g.label });
        }
      } finally {
        if (reqId === geocodeReq.current) setQuoting(false);
      }
    }, 900);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, mode, zoneActive, originLat, originLng, isCheckoutOpen, preGeocoded]);

  // Auto-select default saved address on open (only if user hasn't typed anything)
  useEffect(() => {
    if (!isCheckoutOpen) return;
    if (savedAddresses.loading) return;
    if (selectedAddressId) return;
    if (address.trim()) return;
    const def = savedAddresses.items.find((a) => a.is_default) ?? savedAddresses.items[0];
    if (def) {
      setSelectedAddressId(def.id);
      setAddress(def.address);
      setReference(def.reference ?? "");
      if (def.lat != null && def.lng != null) {
        setPreGeocoded({ lat: def.lat, lng: def.lng, address: def.address });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckoutOpen, savedAddresses.loading, savedAddresses.items]);

  const pickSavedAddress = (a: UserAddress) => {
    setSelectedAddressId(a.id);
    setAddress(a.address);
    setReference(a.reference ?? "");
    if (a.lat != null && a.lng != null) {
      setPreGeocoded({ lat: a.lat, lng: a.lng, address: a.address });
    } else {
      setPreGeocoded(null);
    }
  };

  const currentAddressIsSaved =
    !!savedAddresses.items.find(
      (a) => a.address.trim().toLowerCase() === address.trim().toLowerCase(),
    );

  const saveCurrentAddress = async () => {
    if (!user) return;
    if (!address.trim()) {
      toast.error("Digite o endereço antes de salvar");
      return;
    }
    setSavingAddress(true);
    try {
      const created = await savedAddresses.create({
        label: savedAddresses.items.length === 0 ? "Casa" : "Outro",
        address: address.trim(),
        reference: reference.trim() || null,
        lat: quote?.lat ?? null,
        lng: quote?.lng ?? null,
      });
      setSelectedAddressId(created.id);
      toast.success("Endereço salvo no seu perfil!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao salvar: ${msg}`);
    } finally {
      setSavingAddress(false);
    }
  };

  if (!pageMode && !isCheckoutOpen) return null;

  const flatFee = settings?.deliveryFee ?? BRAND.deliveryFee;
  const freeThreshold = settings?.freeDeliveryThreshold ?? 0;
  const outsideRadius =
    zoneActive && zone && quote ? !isWithinRadius(quote.km, zone) : false;

  const rawFee =
    mode === "entrega"
      ? zoneActive && zone && quote
        ? outsideRadius
          ? 0
          : calcDeliveryFee(quote.km, zone, flatFee)
        : flatFee
      : 0;
  const freeDelivery =
    mode === "entrega" && freeThreshold > 0 && subtotal >= freeThreshold;
  const fee = freeDelivery ? 0 : rawFee;
  // Recomputa o desconto quando o subtotal muda:
  // - promo em %: recalcula sobre o subtotal atual;
  // - fixo/loyalty: nunca desconta mais do que o subtotal.
  // Fatura mínima do site: o valor cobrado (mercadoria após cupom) não pode
  // ficar abaixo de R$ 5. Se o desconto do cupom levaria o subtotal abaixo
  // desse piso, o desconto é limitado para preservar o mínimo — o cupom
  // ainda é aplicado, mas nunca reduz a conta a menos de R$ 5.
  const MIN_INVOICE_BRL = 5;
  const rawDiscount = (() => {
    if (!couponApplied) return 0;
    if (couponApplied.discountType === "percent" && couponApplied.discountValue) {
      return Math.round((subtotal * couponApplied.discountValue) / 100 * 100) / 100;
    }
    return Math.min(couponApplied.discount, subtotal);
  })();
  const maxDiscountKeepingMin = couponApplied
    ? Math.max(0, subtotal - MIN_INVOICE_BRL)
    : rawDiscount;
  const discount = couponApplied ? Math.min(rawDiscount, maxDiscountKeepingMin) : rawDiscount;
  const discountCappedByMin = couponApplied != null && rawDiscount > (couponApplied ? Math.min(rawDiscount, Math.max(0, subtotal - MIN_INVOICE_BRL)) : rawDiscount);
  void discountCappedByMin;
  const total = Math.max(0, subtotal + fee - discount);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const billableAfterDiscount = Math.max(0, subtotal - discount);
  const belowMinInvoice = items.length > 0 && billableAfterDiscount < MIN_INVOICE_BRL;


  // Revalida o mínimo do cupom sempre que o subtotal cair (item removido,
  // quantidade reduzida, edição de sabor barato). Se ficar abaixo, remove
  // o cupom automaticamente e avisa — evita desconto indevido no total.
  useEffect(() => {
    if (!couponApplied) return;
    if (items.length === 0) {
      setCouponApplied(null);
      return;
    }
    if (subtotal < couponApplied.minOrder) {
      const min = couponApplied.minOrder;
      const code = couponApplied.code;
      setCouponApplied(null);
      toast.error(`Cupom ${code} removido`, {
        description: `Pedido mínimo de ${brl(min)} não foi atingido.`,
      });
    }
  }, [subtotal, items.length, couponApplied]);

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (!user) {
      toast.error("Entre na sua conta para usar cupom.");
      return;
    }
    setCouponChecking(true);
    try {
      // 1) Tenta cupom promocional criado pelo admin
      const { data: promo, error: promoErr } = await supabase.rpc("validate_promo_coupon", {
        _code: code,
        _order_total: subtotal,
      });
      if (!promoErr && Array.isArray(promo) && promo.length > 0) {
        const row = promo[0] as {
          id: string;
          code: string;
          discount: number;
          discount_type?: "fixed" | "percent";
          discount_value?: number;
          min_order?: number;
        };
        setCouponApplied({
          id: row.id,
          code: row.code,
          discount: Number(row.discount),
          kind: "promo",
          minOrder: Number(row.min_order ?? 0),
          discountType: row.discount_type,
          discountValue: row.discount_value != null ? Number(row.discount_value) : undefined,
        });
        toast.success(`Cupom aplicado! −${brl(Number(row.discount))}`);
        return;
      }

      // 2) Cai para o cupom Bis Recompensa (fidelidade)
      const { data, error } = await supabase.rpc("validate_loyalty_coupon", { _code: code });
      if (error) throw error;
      const row = Array.isArray(data) ? (data[0] as { id: string; code: string; discount_value?: number } | undefined) : null;
      if (row) {
        const rewardValue = Number(row.discount_value) > 0 ? Number(row.discount_value) : 20;
        if (subtotal < rewardValue) {
          toast.error(`Pedido mínimo de ${brl(rewardValue)} para usar este cupom.`);
          return;
        }
        const discountValue = Math.min(rewardValue, subtotal);
        setCouponApplied({
          id: row.id,
          code: row.code,
          discount: discountValue,
          kind: "loyalty",
          minOrder: rewardValue,
          discountType: "fixed",
          discountValue: rewardValue,
        });
        toast.success(`Cupom aplicado! −${brl(discountValue)}`);
        return;
      }

      // Mensagem específica do erro do RPC promocional
      const msg = promoErr?.message ?? "";
      if (msg.includes("order_below_minimum")) toast.error("Pedido abaixo do mínimo pra este cupom.");
      else if (msg.includes("coupon_expired")) toast.error("Cupom expirado.");
      else if (msg.includes("coupon_not_started")) toast.error("Este cupom ainda não começou.");
      else if (msg.includes("coupon_exhausted")) toast.error("Cupom esgotado.");
      else if (msg.includes("coupon_inactive")) toast.error("Cupom inativo.");
      else if (msg.includes("coupon_user_limit")) toast.error("Você já usou este cupom.");
      else toast.error("Cupom inválido.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível validar o cupom.");
    } finally {
      setCouponChecking(false);
    }
  };

  const removeCoupon = () => {
    setCouponApplied(null);
    setCouponInput("");
  };

  const goLogin = () => {
    sessionStorage.setItem("querobis:resume_checkout", "1");
    closeCheckout();
    navigate({ to: "/auth", search: { next: "/finalizar" } as never });
  };

  const send = async () => {
    const fail = (message: string) => {
      setActionError(message);
      toast.error(message, { id: "checkout-validation", duration: 9000 });
    };
    setActionError(null);
    if (storeStatus.isClosed) {
      fail(STORE_COPY.closedShort(storeStatus));
      return;
    }
    if (belowMinInvoice) {
      fail(
        `Pedido mínimo online de ${brl(MIN_INVOICE_BRL)}. Para valores menores, dirija-se presencialmente à loja para concluir a compra.`,
      );
      return;
    }
    if (authLoading) {
      fail("Ainda estamos carregando sua conta. Tente novamente em alguns segundos.");
      return;
    }
    if (!isAuthenticated || !user) {
      setActionError("Entre ou crie sua conta para finalizar o pedido.");
      goLogin();
      return;
    }
    if (!name.trim() || !phone.trim() || (mode === "entrega" && !address.trim())) {
      fail("Preencha os campos obrigatórios: nome, telefone" + (mode === "entrega" ? " e endereço" : "") + ".");
      return;
    }
    if (mode === "entrega") {
      const missing: string[] = [];
      if (!addrStreet.trim()) missing.push("rua");
      if (!addrNumber.trim()) missing.push("número");
      if (!addrNeighborhood.trim()) missing.push("bairro");
      if (!addrCity.trim()) missing.push("cidade");
      if (missing.length) {
        fail(`Endereço incompleto — informe: ${missing.join(", ")}.`);
        return;
      }
    }

    if ((paymentMethod === "pix" || paymentMethod === "asaas_checkout") && !isValidCpf(cpf)) {
      fail("CPF válido obrigatório para gerar PIX ou abrir o checkout Asaas.");
      return;
    }

    if (paymentMethod === "cartao") {
      if (!isValidCpf(cpf)) { fail("CPF inválido — obrigatório para pagamento com cartão."); return; }
      if (!(savedCard && useSavedCard)) {
        const numDigits = cardNumber.replace(/\D/g, "");
        const exp = cardExpiry.replace(/\D/g, "");
        const effEmail = (cardEmail || user?.email || "").trim();
        const effCep = (cardCep || cep).replace(/\D/g, "");
        const effAddrNumber = (cardAddrNumber || addrNumber).trim();
        if (!cardHolder.trim()) { fail("Informe o nome como está no cartão."); return; }
        if (numDigits.length < 13) { fail("Número do cartão inválido."); return; }
        if (exp.length !== 4) { fail("Validade inválida (use MM/AA)."); return; }
        if (cardCcv.length < 3) { fail("CVV inválido."); return; }
        if (effCep.length !== 8) { fail("CEP inválido."); return; }
        if (!effAddrNumber) { fail("Informe o número do endereço do titular."); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effEmail)) { fail("E-mail inválido."); return; }
      }
    }
    if (mode === "entrega" && outsideRadius) {
      fail(
        zone?.outsideMessage ||
          "Endereço fora do nosso raio de entrega. Tente retirada na loja.",
      );
      return;
    }

    setSending(true);
    if (paymentMethod === "whatsapp") {
      toast.loading("Criando seu pedido…", { id: "checkout-submit" });
    }
    try {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          mode,
          customer_name: name.trim(),
          phone: phone.trim(),
          address: mode === "entrega" ? address.trim() : null,
          reference: reference.trim() || null,
          note: note.trim() || null,
          subtotal,
          delivery_fee: fee,
          total,
          coupon_code: couponApplied?.code ?? null,
          coupon_discount: couponApplied?.discount ?? 0,
          distance_km: mode === "entrega" && quote ? Number(quote.km.toFixed(3)) : null,
          delivery_lat: mode === "entrega" && quote ? quote.lat : null,
          delivery_lng: mode === "entrega" && quote ? quote.lng : null,
          payment_method: paymentMethod, // "whatsapp" | "pix" | "cartao" | "asaas_checkout"
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;

      // Guarda referência local do pedido para recuperação (independe de RLS/sessão)
      try {
        const KEY = "querobis:recent_orders";
        const online = paymentMethod === "pix" || paymentMethod === "cartao" || paymentMethod === "asaas_checkout";
        const prev = JSON.parse(localStorage.getItem(KEY) || "[]");
        const next = [
          { id: order.id, at: Date.now(), payment_method: paymentMethod, total, needs_payment: online },
          ...prev.filter((x: any) => x?.id && x.id !== order.id),
        ].slice(0, 10);
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}

      const itemsPayload = items.map((it) => ({
        order_id: order.id,
        product_id: it.productId,
        name: it.name,
        size: it.size ?? null,
        flavor: it.flavor ?? null,
        extras: it.extras,
        removed: it.removed,
        note: it.note ?? null,
        quantity: it.quantity,
        unit_price: it.unitPrice,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      await supabase.from("profiles").upsert({
        id: user.id,
        full_name: name.trim(),
        phone: phone.trim(),
        address: address.trim() || null,
        reference: reference.trim() || null,
      });

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ name: name.trim(), phone: phone.trim(), address: address.trim(), reference: reference.trim() }),
        );
      } catch (e) {
        // Sem toast: os dados já foram persistidos no perfil (Supabase) acima.
        // O cache local é apenas para pré-preencher na próxima visita.
        logSilent("checkout:save-customer", e);
      }

      if (couponApplied) {
        const { data: redeemed, error: redeemErr } =
          couponApplied.kind === "promo"
            ? await supabase.rpc("redeem_promo_coupon", {
                _code: couponApplied.code,
                _order_total: subtotal,
                _order_id: order.id,
              })
            : await supabase.rpc("redeem_loyalty_coupon", { _code: couponApplied.code });
        const rows = Array.isArray(redeemed) ? redeemed : [];
        if (redeemErr || rows.length === 0) {
          toast.error("Não foi possível usar o cupom. Ele pode já ter sido utilizado.");
          setSending(false);
          return;
        }
      }

      // Consolidar carrinho compartilhado (se houver)
      try {
        const shareToken = sessionStorage.getItem("querobis:merge_share_token");
        if (shareToken) {
          await supabase.rpc("merge_shared_cart", { _token: shareToken, _order_id: order.id });
          sessionStorage.removeItem("querobis:merge_share_token");
        }
      } catch (e) {
        console.warn("merge_shared_cart failed", e);
      }

      if (paymentMethod === "whatsapp") {
        const msg = buildMessage({ items, name, phone, address, reference, note, mode, fee, total, coupon: couponApplied ? { code: couponApplied.code, discount: couponApplied.discount } : null });
        const url = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(msg)}`;
        clear();
        closeCheckout();
        toast.success("Pedido criado! Abrindo WhatsApp…", { id: "checkout-submit" });
        window.location.assign(url);
        return;
      } else if (paymentMethod === "cartao") {
        // Processa cartão via Asaas AGORA, mostrando erro claro se algo falhar
        const exp = cardExpiry.replace(/\D/g, "");
        const expiryMonth = exp.slice(0, 2);
        let expiryYear = exp.slice(2);
        if (expiryYear.length === 2) expiryYear = `20${expiryYear}`;
        try {
          const usingSaved = Boolean(savedCard && useSavedCard);
          const result = await runCardCharge({
            data: {
              orderId: order.id,
              customer: {
                name: name.trim(),
                email: (cardEmail || user?.email || "").trim(),
                cpfCnpj: cpfDigits(cpf),
                phone: phone.replace(/\D/g, ""),
                postalCode: (cardCep || cep).replace(/\D/g, ""),
                addressNumber: (cardAddrNumber || addrNumber).trim(),
              },
              ...(usingSaved ? {} : {
                card: {
                  holderName: cardHolder.trim(),
                  number: cardNumber.replace(/\D/g, ""),
                  expiryMonth,
                  expiryYear,
                  ccv: cardCcv,
                },
              }),
              useSavedCard: usingSaved || undefined,
              saveCard: !usingSaved && saveCard && !!user ? true : undefined,
              installmentCount: installments > 1 ? installments : undefined,
            },
          });
          const st = String(result?.status ?? "").toUpperCase();
          if (["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "PAID"].includes(st)) {
            toast.success("Pagamento aprovado! 🎉");
          } else if (["PENDING", "AUTHORIZED"].includes(st)) {
            toast.info("Pagamento em análise — o pedido só será confirmado quando a operadora aprovar.");
          } else {
            throw new Error(`Pagamento não aprovado (${st || "status desconhecido"}). Tente outro cartão ou PIX.`);
          }
          try {
            sessionStorage.setItem(PAYMENT_REDIRECT_KEY, String(Date.now() + 60_000));
          } catch {}
          await navigate({ to: "/pagamento/$orderId", params: { orderId: order.id }, search: { m: paymentMethod } as never });
          clear();
          closeCheckout();
        } catch (payErr: any) {
          console.error("[checkout] card charge failed", payErr);
          const raw = payErr?.message || payErr?.error_description || (typeof payErr === "string" ? payErr : "");
          const friendly = raw.includes("invalid_credit_card") ? "Cartão recusado — verifique os dados."
            : raw.includes("insufficient_funds") ? "Cartão sem saldo suficiente."
            : raw.includes("expired") ? "Cartão expirado."
            : raw || "Não foi possível processar o cartão.";
          toast.error("Pagamento recusado", { description: friendly, duration: 10000 });
          // Não apaga o pedido — usuário pode tentar de novo em /pagamento/:orderId
          setSending(false);
          return;
        }
      } else if (paymentMethod === "asaas_checkout") {
        try {
          const res = await runAsaasCheckout({
            data: {
              orderId: order.id,
              customer: {
                name: name.trim(),
                email: (cardEmail || user?.email || "").trim() || undefined,
                cpfCnpj: cpf ? cpfDigits(cpf) : undefined,
                phone: phone.replace(/\D/g, "") || undefined,
              },
              origin: window.location.origin,
            },
          });
          try {
            sessionStorage.setItem(PAYMENT_REDIRECT_KEY, String(Date.now() + 60_000));
          } catch {}
          // Guarda o link para exibir fallback caso o navegador do usuário bloqueie asaas.com
          try {
            sessionStorage.setItem(`querobis:asaas_url:${order.id}`, res.url);
          } catch {}
          // Abre em nova aba e leva o usuário para a página do pedido com fallback (copiar link etc.)
          try {
            window.open(res.url, "_blank", "noopener,noreferrer");
          } catch {}
          await navigate({ to: "/pagamento/$orderId", params: { orderId: order.id }, search: { m: "asaas" } as never });
          clear();
          closeCheckout();
          return;
        } catch (chkErr: any) {
          console.error("[checkout] asaas checkout failed", chkErr);
          toast.error("Não foi possível abrir o checkout Asaas", { description: chkErr?.message ?? "Tente novamente." });
          setSending(false);
          return;
        }

      } else {
        // PIX
        try {
          sessionStorage.setItem(
            "querobis:pending_payment_cpf",
            JSON.stringify({
              name: name.trim(),
              phone: phone.trim(),
              email: (cardEmail || user?.email || "").trim(),
              cpf: cpf ? cpfDigits(cpf) : "",
            }),
          );
        } catch (e) {
          logSilent("checkout:save-customer", e);
        }
        try {
          sessionStorage.setItem(PAYMENT_REDIRECT_KEY, String(Date.now() + 60_000));
        } catch {}
        await navigate({ to: "/pagamento/$orderId", params: { orderId: order.id }, search: { m: paymentMethod } as never });
        clear();
        closeCheckout();
      }
    } catch (err: any) {
      console.error("[checkout] send failed", err);
      const detail =
        err?.message ||
        err?.error_description ||
        err?.details ||
        (typeof err === "string" ? err : "");
      toast.error("Erro ao enviar o pedido", {
        id: "checkout-submit",
        description: detail || "Tente novamente em instantes. Se persistir, avise a loja.",
        duration: 8000,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={pageMode ? "min-h-dvh bg-[oklch(0.14_0.09_305)] text-white" : "fixed inset-0 z-50"}>
      {!pageMode && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={closeCheckout} />
      )}
      <div
        className={
          pageMode
            ? "mx-auto flex min-h-dvh max-w-2xl flex-col"
            : "absolute inset-x-0 bottom-0 top-[6vh] flex flex-col overflow-hidden rounded-t-[28px] card-acai animate-in slide-in-from-bottom duration-300"
        }
      >
        {!pageMode && (
          <button
            onClick={closeCheckout}
            className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <form
          className={
            pageMode
              ? "flex-1 space-y-5 px-4 pb-6 pt-4"
              : "flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-6"
          }
          autoComplete="on"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {/* Header simples com detalhe */}
          <div className={pageMode ? "pb-2" : "-mx-4 -mt-6 px-5 pb-4 pt-6 pr-16"}>


            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan shadow-[0_0_8px_theme(colors.neon-cyan)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-cyan/90">Checkout</span>
            </div>
            <h3 className="mt-0.5 text-[22px] font-black leading-tight text-white">
              Finalizar <span className="bg-gradient-to-r from-neon-cyan to-neon-pink bg-clip-text text-transparent">pedido</span>
            </h3>
            <p className="mt-1 text-[12px] text-white/60">
              Falta pouco — confira seus dados abaixo.
            </p>
            <div className="mt-3 h-px w-full bg-gradient-to-r from-neon-cyan/50 via-neon-pink/30 to-transparent" />
          </div>

          {storeStatus.isClosed && (
            <div className="rounded-2xl border border-red-400/40 bg-gradient-to-br from-red-500/15 to-rose-500/10 p-4" role="alert">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/25 ring-1 ring-red-400/40 text-red-100">
                  <MoonStar className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-white">
                    {STORE_COPY.closedHeadline(storeStatus)}
                  </div>
                  <div className="mt-1 text-[12px] leading-snug text-white/80">
                    {storeStatus.nextOpenLabel
                      ? `Você pode montar seu pedido, mas o envio só é liberado quando reabrirmos ${storeStatus.nextOpenLabel}.`
                      : "Você pode montar seu pedido, mas o envio só é liberado quando reabrirmos."}
                  </div>
                </div>
              </div>
            </div>
          )}

          {storeStatus.closingSoon && storeStatus.minutesUntilClose !== null && (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3" role="status">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-amber-100">
                <ClockIcon className="h-4 w-4 text-amber-300" />
                Fechamos em {storeStatus.minutesUntilClose} min · finalize o pedido para garantir.
              </div>
            </div>
          )}

          {!authLoading && !isAuthenticated && (
            <div className="rounded-2xl border border-neon-yellow/40 bg-neon-yellow/10 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-neon-yellow" />
                <div className="flex-1">
                  <div className="text-sm font-extrabold text-neon-yellow">
                    Entre para finalizar seu pedido
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-white/70">
                    A cada pedido você ganha 1 selo Bis Recompensa. 10 selos = R$ 20 de desconto!
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={goLogin}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-yellow px-4 py-3 text-sm font-extrabold text-[oklch(0.18_0.11_305)] active:scale-[.98]"
              >
                <LogIn className="h-4 w-4" />
                Entrar ou criar conta
              </button>
            </div>
          )}

          {/* Mode tabs — Retirada / Entrega */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5">
            <ModeTab active={mode === "retirada"} onClick={() => setMode("retirada")} icon={Store} label="Retirada" />
            <ModeTab active={mode === "entrega"} onClick={() => setMode("entrega")} icon={Truck} label="Entrega" />
          </div>

          {/* Form fields with icons */}
          <div className="space-y-2.5">
            <IconField
              icon={User}
              label="Nome"
              value={name}
              onChange={setName}
              placeholder="Seu nome completo"
              autoComplete="name"
              name="name"
            />
            <IconField
              icon={Phone}
              label="Telefone"
              value={phone}
              onChange={(v) => setPhone(formatPhone(v))}
              placeholder="(69) 99999-9999"
              autoComplete="tel"
              name="tel"
              type="tel"
              inputMode="tel"
              trailing={<div className="grid h-8 w-8 place-items-center rounded-full bg-[#25D366] text-white"><MessageCircle className="h-4 w-4" /></div>}
            />
            {mode === "entrega" && (
              <>
                {isAuthenticated && savedAddresses.items.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
                      <Star className="h-3 w-3 text-neon-cyan" /> Endereços salvos
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {savedAddresses.items.map((a) => {
                        const active = selectedAddressId === a.id;
                        const Icon =
                          a.label.toLowerCase() === "trabalho"
                            ? Briefcase
                            : a.label.toLowerCase() === "casa"
                              ? Home
                              : MapPin;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => pickSavedAddress(a)}
                            className={cn(
                              "flex min-w-[140px] max-w-[200px] shrink-0 items-start gap-2 rounded-xl border p-2 text-left transition",
                              active
                                ? "border-neon-cyan/50 bg-neon-cyan/10"
                                : "border-white/10 bg-white/5 hover:bg-white/10",
                            )}
                          >
                            <div
                              className={cn(
                                "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                                active ? "bg-neon-cyan/20 text-neon-cyan" : "bg-white/10 text-white/80",
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <span className="truncate text-[11px] font-bold text-white">{a.label}</span>
                                {a.is_default && (
                                  <Star className="h-2.5 w-2.5 shrink-0 fill-neon-cyan text-neon-cyan" />
                                )}
                              </div>
                              <div className="truncate text-[10px] text-white/60">{a.address}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {(() => {
                  const updatePart = (patch: Partial<{ street: string; number: string; neighborhood: string; city: string }>) => {
                    const next = {
                      street: patch.street ?? addrStreet,
                      number: patch.number ?? addrNumber,
                      neighborhood: patch.neighborhood ?? addrNeighborhood,
                      city: patch.city ?? addrCity,
                    };
                    if (patch.street !== undefined) setAddrStreet(patch.street);
                    if (patch.number !== undefined) setAddrNumber(patch.number);
                    if (patch.neighborhood !== undefined) setAddrNeighborhood(patch.neighborhood);
                    if (patch.city !== undefined) setAddrCity(patch.city);
                    setAddress(joinAddressParts(next));
                    setSelectedAddressId(null);
                    setPreGeocoded(null);
                  };
                  const lookupCep = async (raw: string) => {
                    const digits = raw.replace(/\D/g, "").slice(0, 8);
                    setCep(digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits);
                    if (digits.length !== 8) return;
                    setCepLoading(true);
                    try {
                      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
                      const data = await res.json();
                      if (data?.erro) {
                        toast.error("CEP não encontrado");
                        return;
                      }
                      const patch: Partial<{ street: string; number: string; neighborhood: string; city: string }> = {};
                      if (data.logradouro) patch.street = data.logradouro;
                      if (data.bairro) patch.neighborhood = data.bairro;
                      if (data.localidade) patch.city = data.localidade;
                      updatePart(patch);
                      toast.success("Endereço preenchido pelo CEP");
                      setTimeout(() => {
                        const el = document.querySelector<HTMLInputElement>('input[name="street-number"]');
                        el?.focus();
                      }, 50);
                    } catch {
                      toast.error("Não foi possível buscar o CEP");
                    } finally {
                      setCepLoading(false);
                    }
                  };
                  const useCurrentLocation = () => {
                    if (!("geolocation" in navigator)) {
                      toast.error("Geolocalização não suportada");
                      return;
                    }
                    setGeoLoading(true);
                    navigator.geolocation.getCurrentPosition(
                      async ({ coords }) => {
                        try {
                          const text = await reverseGeocode(coords.latitude, coords.longitude);
                          if (!text) {
                            toast.error("Não conseguimos identificar seu endereço");
                            return;
                          }
                          const p = parseAddressParts(text);
                          const patch: Partial<{ street: string; number: string; neighborhood: string; city: string }> = {};
                          if (p.street) patch.street = p.street;
                          if (p.number) patch.number = p.number;
                          if (p.neighborhood) patch.neighborhood = p.neighborhood;
                          if (p.city) patch.city = p.city;
                          updatePart(patch);
                          setPreGeocoded({ lat: coords.latitude, lng: coords.longitude, address: joinAddressParts({
                            street: patch.street ?? addrStreet,
                            number: patch.number ?? addrNumber,
                            neighborhood: patch.neighborhood ?? addrNeighborhood,
                            city: patch.city ?? addrCity,
                          }) });
                          setQuote({ lat: coords.latitude, lng: coords.longitude, km: 0, label: text });
                          toast.success("Endereço detectado pela sua localização");
                        } finally {
                          setGeoLoading(false);
                        }
                      },
                      (err) => {
                        setGeoLoading(false);
                        toast.error(err.code === 1 ? "Permita acesso à localização" : "Falha ao obter localização");
                      },
                      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
                    );
                  };
                  return (
                    <>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                        <div className="mb-2 flex items-center gap-1.5 px-1">
                          <Sparkles className="h-3 w-3 text-neon-cyan" />
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neon-cyan/90">
                            Preenchimento rápido
                          </span>
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
                            <input
                              value={cep}
                              onChange={(e) => lookupCep(e.target.value)}
                              placeholder="CEP (auto preenche)"
                              inputMode="numeric"
                              autoComplete="postal-code"
                              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-8 pr-9 text-[13px] font-bold text-white placeholder:font-normal placeholder:text-white/40 focus:border-neon-cyan/50 focus:outline-none"
                            />
                            {cepLoading && (
                              <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-neon-cyan" />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={useCurrentLocation}
                            disabled={geoLoading}
                            className="flex items-center gap-1.5 rounded-xl bg-neon-cyan/15 px-3 py-2.5 text-[12px] font-black text-neon-cyan ring-1 ring-neon-cyan/30 transition hover:bg-neon-cyan/25 active:scale-[.97] disabled:opacity-60"
                          >
                            {geoLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Navigation className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline">Minha localização</span>
                            <span className="sm:hidden">GPS</span>
                          </button>
                        </div>
                        <div className="mt-1.5 px-1 text-[10px] leading-tight text-white/45">
                          Digite o CEP ou toque em GPS — completamos rua, bairro e cidade automaticamente.
                        </div>
                      </div>
                      <div className="grid grid-cols-[1fr_110px] gap-2">

                        <IconField
                          icon={MapPin}
                          label="Rua / Avenida"
                          value={addrStreet}
                          onChange={(v) => updatePart({ street: v })}
                          placeholder="Ex: Av. Brasil"
                          autoComplete="address-line1"
                          name="address-line1"
                        />
                        <IconField
                          icon={MapPin}
                          label="Número"
                          value={addrNumber}
                          onChange={(v) => updatePart({ number: v })}
                          placeholder="Nº"
                          inputMode="numeric"
                          autoComplete="off"
                          name="street-number"

                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <IconField
                          icon={MapPin}
                          label="Bairro"
                          value={addrNeighborhood}
                          onChange={(v) => updatePart({ neighborhood: v })}
                          placeholder="Ex: Centro"
                          autoComplete="address-level3"
                          name="address-level3"
                        />
                        <IconField
                          icon={MapPin}
                          label="Cidade"
                          value={addrCity}
                          onChange={(v) => updatePart({ city: v })}
                          placeholder="(opcional)"
                          autoComplete="address-level2"
                          name="address-level2"
                        />
                      </div>
                    </>
                  );
                })()}

                <AddressMapInline
                  value={{
                    lat: preGeocoded?.lat ?? quote?.lat ?? null,
                    lng: preGeocoded?.lng ?? quote?.lng ?? null,
                  }}
                  storeOrigin={{ lat: originLat, lng: originLng }}
                  onChange={(loc: InlinePickedLocation) => {
                    const p = parseAddressParts(loc.address);
                    const nextAddress =
                      joinAddressParts({
                        street: p.street || addrStreet,
                        number: p.number || addrNumber,
                        neighborhood: p.neighborhood || addrNeighborhood,
                        city: p.city || addrCity,
                      }) || loc.address;
                    if (p.street) setAddrStreet(p.street);
                    if (p.number) setAddrNumber(p.number);
                    if (p.neighborhood) setAddrNeighborhood(p.neighborhood);
                    if (p.city) setAddrCity(p.city);
                    setAddress(nextAddress);
                    setPreGeocoded({ lat: loc.lat, lng: loc.lng, address: nextAddress });
                    if (originLat != null && originLng != null) {
                      const km = haversineKm(
                        { lat: originLat, lng: originLng },
                        { lat: loc.lat, lng: loc.lng },
                      );
                      setQuote({ lat: loc.lat, lng: loc.lng, km, label: nextAddress });
                    }
                    setSelectedAddressId(null);
                  }}
                />

                <IconField
                  icon={MapPin}
                  label="Referência"
                  value={reference}
                  onChange={setReference}
                  placeholder="Ex: Próximo à igreja, mercado, etc."
                  autoComplete="address-line2"
                  name="address-line2"
                />
                {isAuthenticated && address.trim().length >= 6 && !currentAddressIsSaved && (
                  <button
                    type="button"
                    onClick={saveCurrentAddress}
                    disabled={savingAddress}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-2 text-[12px] font-bold text-neon-cyan transition hover:bg-neon-cyan/15 active:scale-[.99] disabled:opacity-60"
                  >
                    {savingAddress ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Salvar este endereço no meu perfil
                  </button>
                )}
              </>
            )}
            <IconField
              icon={MessageCircle}
              label="Observação"
              value={note}
              onChange={setNote}
              placeholder="Alguma observação do pedido? (opcional)"
              autoComplete="off"
            />
          </div>

          {/* Cotação de frete por distância */}
          {mode === "entrega" && zoneActive && address.trim().length >= 6 && (
            <div
              className={cn(
                "rounded-3xl border p-4 transition",
                outsideRadius
                  ? "border-red-400/40 bg-red-500/10"
                  : quote
                    ? "border-neon-cyan/30 bg-neon-cyan/5"
                    : "border-white/10 bg-white/[0.04]",
              )}
              role="status"
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-xl",
                    outsideRadius
                      ? "bg-red-500/25 text-red-200"
                      : "bg-neon-cyan/20 text-neon-cyan",
                  )}
                >
                  {outsideRadius ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Route className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-extrabold text-white">
                    {quoting
                      ? "Calculando frete pela distância…"
                      : outsideRadius
                        ? "Endereço fora do raio de entrega"
                        : quote
                          ? `Distância: ${quote.km.toFixed(2)} km`
                          : quoteError
                            ? "Não consegui localizar o endereço"
                            : "Aguardando endereço…"}
                  </div>
                  <div className="text-[11px] text-white/60 truncate">
                    {quoteError && !quoting
                      ? quoteError
                      : quote
                        ? outsideRadius
                          ? zone?.outsideMessage
                          : freeDelivery
                            ? `Frete grátis a partir de ${brl(freeThreshold)} ✓`
                            : `Frete calculado: ${brl(rawFee)}${zone?.maxKm ? ` · raio ${zone.maxKm} km` : ""}`
                        : `Digite o endereço completo para calcular${zone?.maxKm ? ` (raio ${zone.maxKm} km)` : ""}.`}
                  </div>
                </div>
                {quoting && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
              </div>
            </div>
          )}

          <CheckoutUpsellStrip />

          {mode === "entrega" && <FreeDeliveryBar />}

          {/* Resumo */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/10">
                  <ShoppingBag className="h-4 w-4 text-white" />
                </div>
                <h4 className="font-display text-base font-extrabold text-white">Resumo</h4>
              </div>
              <span className="text-xs font-bold text-neon-yellow">
                {itemCount} {itemCount === 1 ? "item" : "itens"}
              </span>
            </div>

            <div className="space-y-2.5">
              {items.map((it) => (
                <div key={it.uid} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2.5">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[oklch(0.24_0.14_305)]">
                    <img src={it.image} alt={it.name} className="h-full w-full object-contain p-1" loading="lazy" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">{it.name}</div>
                    <div className="truncate text-[11px] text-white/60">
                      {[it.size, it.flavor, ...it.extras.map((e) => e.label)].filter(Boolean).join(" · ") || "\u00a0"}
                    </div>
                    {it.removed.length > 0 && (
                      <div className="truncate text-[11px] text-neon-pink/80">sem {it.removed.join(", ")}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="font-display text-sm font-extrabold text-neon-yellow whitespace-nowrap">
                      {brl(it.unitPrice * it.quantity)}
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-0.5">
                      <button
                        type="button"
                        onClick={() => update(it.uid, { quantity: Math.max(1, it.quantity - 1) })}
                        className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white active:scale-95"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <div className="w-5 text-center text-xs font-bold text-white">{it.quantity}</div>
                      <button
                        type="button"
                        onClick={() => update(it.uid, { quantity: it.quantity + 1 })}
                        className="grid h-6 w-6 place-items-center rounded-full bg-neon-cyan text-[oklch(0.18_0.11_305)] active:scale-95"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm">
              <div className="flex justify-between text-white/70"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
              <div className="flex justify-between text-white/70">
                <span>{mode === "entrega" ? "Taxa de entrega" : "Retirada na loja"}</span>
                <span>{fee > 0 ? brl(fee) : "Grátis"}</span>
              </div>
              {couponApplied && (
                <div className="flex justify-between text-neon-cyan">
                  <span>Cupom {couponApplied.code}</span>
                  <span>−{brl(couponApplied.discount)}</span>
                </div>
              )}
              <div className="mt-2 flex items-end justify-between">
                <span className="font-display text-lg font-extrabold text-white">Total</span>
                <span className="font-display text-3xl font-extrabold text-neon-yellow glow-yellow-text">{brl(total)}</span>
              </div>
            </div>

          </div>


          {/* Cupom Bis Recompensa */}
          {couponApplied ? (
            <div className="rounded-3xl border border-neon-cyan/40 bg-neon-cyan/10 p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Check className="h-4 w-4 text-neon-cyan shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">Cupom {couponApplied.code}</div>
                  <div className="truncate text-[11px] text-neon-cyan">Desconto de {brl(couponApplied.discount)}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={removeCoupon}
                className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/80 active:scale-95"
              >
                Remover
              </button>
            </div>
          ) : couponOpen ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-neon-cyan/15 text-neon-cyan">
                    <Ticket className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-white">Cupom de desconto</div>
                    <div className="text-[11px] text-white/60">Tem um código Bis Recompensa?</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCouponOpen(false)}
                  className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold text-white/70 active:scale-95"
                >
                  Fechar
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="BIS-XXXXXXXX"
                  className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-mono uppercase tracking-wider text-white placeholder:text-white/30 outline-none focus:border-neon-cyan/60"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponChecking || !couponInput.trim()}
                  className="rounded-2xl bg-neon-cyan px-4 py-2.5 text-sm font-extrabold text-[oklch(0.18_0.11_305)] active:scale-95 disabled:opacity-50"
                >
                  {couponChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                </button>
              </div>
              {availableCoupons.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    Seus cupons disponíveis
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {availableCoupons.map((c) => {
                      const belowMin = c.minOrder != null && subtotal < c.minOrder;
                      return (
                        <button
                          key={`${c.kind}-${c.id}`}
                          type="button"
                          disabled={couponChecking || belowMin}
                          onClick={() => {
                            setCouponInput(c.code);
                            setTimeout(() => applyCoupon(), 0);
                          }}
                          className="group flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-neon-cyan/50 hover:bg-neon-cyan/5 active:scale-[0.99] disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:bg-white/[0.03]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-neon-cyan/15 text-neon-cyan">
                              <Ticket className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-extrabold text-white font-mono tracking-wider">
                                {c.code}
                              </div>
                              <div className="truncate text-[10.5px] text-white/60">
                                {c.label}
                                {belowMin && c.minOrder != null && ` · mín. ${brl(c.minOrder)}`}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 text-[11px] font-bold text-neon-cyan group-disabled:text-white/30">
                            {belowMin ? "Bloqueado" : "Usar"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCouponOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-sm font-semibold text-white/70 hover:text-white hover:border-white/30 active:scale-[0.99]"
            >
              <Ticket className="h-4 w-4 text-neon-cyan" />
              Tenho um cupom de desconto
              {availableCoupons.length > 0 && (
                <span className="ml-1 rounded-full bg-neon-cyan/20 px-2 py-0.5 text-[10px] font-black text-neon-cyan ring-1 ring-neon-cyan/40">
                  {availableCoupons.length} disponível{availableCoupons.length > 1 ? "is" : ""}
                </span>
              )}
            </button>
          )}

          {/* Forma de pagamento */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-neon-yellow/15 text-neon-yellow">
                <CreditCard className="h-4 w-4" />
              </div>
              <h4 className="font-display text-base font-extrabold text-white">Pagamento</h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "pix" as const, label: "PIX", hint: "QR na hora · Aprovação imediata", Icon: QrCode, color: "text-neon-yellow", badge: "Recomendado" as string | null },
                { id: "cartao" as const, label: "Cartão", hint: "Crédito · Até 12x", Icon: CreditCard, color: "text-neon-pink", badge: null as string | null },
                ...(belowMinInvoice
                  ? [{ id: "whatsapp" as const, label: "WhatsApp", hint: "Combinar depois", Icon: WhatsIcon, color: "text-neon-cyan", badge: null as string | null }]
                  : []),
              ]).map(({ id, label, hint, Icon, color, badge }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaymentMethod(id)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-center transition active:scale-95",
                    paymentMethod === id
                      ? "border-white/40 bg-white/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25",
                  )}
                >
                  {badge && (
                    <span className="absolute -top-1.5 right-1.5 rounded-full bg-neon-yellow px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-[oklch(0.18_0.11_305)]">
                      {badge}
                    </span>
                  )}
                  <Icon className={cn("h-5 w-5", color)} />
                  <div className="text-[12px] font-extrabold text-white leading-tight">{label}</div>
                  <div className="text-[9.5px] text-white/60 leading-tight">{hint}</div>
                </button>
              ))}
            </div>
            {paymentMethod === "asaas_checkout" && (
              <div className="mt-3 space-y-2.5 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/[0.04] p-3">
                <div className="text-[12px] text-white/80">
                  Você será redirecionado para a página segura do Asaas para escolher PIX ou Cartão. Volta pra cá automaticamente depois do pagamento.
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">CPF para pagamento *</label>
                  <input
                    value={formatCpf(cpf)}
                    onChange={(e) => setCpf(e.target.value)}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-neon-cyan/60"
                  />
                </div>
              </div>
            )}
            {paymentMethod === "cartao" && (
              <div className="mt-3 space-y-2.5 rounded-2xl border border-neon-pink/20 bg-neon-pink/[0.04] p-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-neon-pink/80">
                  <CreditCard className="h-3.5 w-3.5" /> Dados do cartão
                  {detectCardBrand(cardNumber) && (
                    <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/80">
                      {detectCardBrand(cardNumber)}
                    </span>
                  )}
                </div>

                {savedCard && (
                  <button
                    type="button"
                    onClick={() => setUseSavedCard((v) => !v)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                      useSavedCard
                        ? "border-emerald-400/40 bg-emerald-400/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25",
                    )}
                  >
                    <CreditCard className={cn("h-5 w-5", useSavedCard ? "text-emerald-300" : "text-white/50")} />
                    <div className="flex-1">
                      <div className="text-[12px] font-bold text-white">{savedCard.brand} •••• {savedCard.last4}</div>
                      <div className="text-[10px] text-white/50">{useSavedCard ? "Cobrar neste cartão (1-clique)" : "Toque para usar cartão salvo"}</div>
                    </div>
                    <div className={cn("h-4 w-4 rounded-full border-2", useSavedCard ? "border-emerald-400 bg-emerald-400" : "border-white/30")} />
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">CPF do titular *</label>
                    <input
                      value={formatCpf(cpf)}
                      onChange={(e) => setCpf(e.target.value)}
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-neon-pink/60"
                    />
                  </div>
                  {!(savedCard && useSavedCard) && (
                    <>
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">Nome no cartão *</label>
                    <input
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                      placeholder="COMO ESTÁ NO CARTÃO"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm uppercase text-white placeholder:text-white/30 outline-none focus:border-neon-pink/60"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">Número do cartão *</label>
                    <input
                      value={formatCardNumber(cardNumber)}
                      onChange={(e) => setCardNumber(e.target.value)}
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="0000 0000 0000 0000"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm tracking-wider text-white placeholder:text-white/30 outline-none focus:border-neon-pink/60"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">Validade *</label>
                    <input
                      value={formatCardExpiry(cardExpiry)}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM/AA"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-neon-pink/60"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">CVV *</label>
                    <input
                      value={cardCcv}
                      onChange={(e) => setCardCcv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="123"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-neon-pink/60"
                    />
                  </div>
                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={() => setCardBillingOpen((v) => !v)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[11px] font-bold text-white/70 hover:border-white/25"
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-neon-pink" />
                        Dados de cobrança
                        <span className="text-[10px] font-normal text-white/50">
                          · {formatCep(cardCep || cep) || "sem CEP"} · nº {cardAddrNumber || addrNumber || "—"}
                        </span>
                      </span>
                      <ChevronDown className={cn("h-3.5 w-3.5 transition", cardBillingOpen && "rotate-180")} />
                    </button>
                    <div className="mt-1 text-[10px] text-white/40">
                      Usamos os dados do endereço automaticamente. Toque para editar.
                    </div>
                  </div>
                  {cardBillingOpen && (
                    <>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">CEP *</label>
                        <input
                          value={formatCep(cardCep || cep)}
                          onChange={(e) => setCardCep(e.target.value)}
                          inputMode="numeric"
                          placeholder="00000-000"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-neon-pink/60"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">Nº endereço *</label>
                        <input
                          value={cardAddrNumber || addrNumber}
                          onChange={(e) => setCardAddrNumber(e.target.value)}
                          inputMode="numeric"
                          placeholder="123"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-neon-pink/60"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">E-mail *</label>
                        <input
                          value={cardEmail || (user?.email ?? "")}
                          onChange={(e) => setCardEmail(e.target.value)}
                          inputMode="email"
                          autoComplete="email"
                          placeholder="voce@email.com"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-neon-pink/60"
                        />
                      </div>
                    </>
                  )}
                    </>
                  )}
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">Parcelas</label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink/60"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n} className="bg-neutral-900">
                          {n}x de {brl(total / n)}{n === 1 ? " (à vista)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!!user && !(savedCard && useSavedCard) && (
                  <label className="flex items-center gap-2 pt-1 text-[11px] text-white/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveCard}
                      onChange={(e) => setSaveCard(e.target.checked)}
                      className="h-4 w-4 accent-neon-pink"
                    />
                    Salvar cartão para próximas compras (1-clique)
                  </label>
                )}

                <div className="flex items-center gap-1.5 pt-1 text-[10px] text-white/50">
                  <Check className="h-3 w-3 text-emerald-400" /> Pagamento processado com criptografia pela Asaas.
                </div>
              </div>
            )}
            {paymentMethod === "pix" && (
              <div className="mt-3 space-y-2.5 rounded-2xl border border-neon-yellow/20 bg-neon-yellow/[0.04] p-3">
                <div className="text-[11.5px] text-white/70">
                  Você verá o QR Code na próxima tela. O pedido é confirmado automaticamente assim que o PIX cair.
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/50">CPF para gerar PIX *</label>
                  <input
                    value={formatCpf(cpf)}
                    onChange={(e) => setCpf(e.target.value)}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-neon-yellow/60"
                  />
                </div>
              </div>
            )}
          </div>


          <div className={pageMode ? "h-24" : "h-20"} />

          <button type="submit" className="sr-only" aria-hidden>Enviar</button>
        </form>

        <div className={pageMode ? "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-2xl border-t border-white/10 bg-[oklch(0.14_0.09_305)]/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur" : "border-t border-white/10 bg-[oklch(0.14_0.09_305)]/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"}>
          {actionError && (
            <div className="mb-2 rounded-xl border border-red-400/40 bg-red-500/15 px-3 py-2 text-center text-[12px] font-bold leading-snug text-red-100">
              {actionError}
            </div>
          )}
          {belowMinInvoice && !actionError && (
            <div
              role="alert"
              className="mb-2 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-left text-[12px] font-semibold leading-snug text-amber-100"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>
                Pedido mínimo online de <strong>{brl(MIN_INVOICE_BRL)}</strong>. Para valores menores,
                dirija-se <strong>presencialmente à loja</strong> para concluir a compra.
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={send}
            disabled={
              sending || belowMinInvoice
            }
            className={cn(
              "flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-4 py-4 text-[15px] font-extrabold leading-none tracking-tight text-white active:scale-[.98] disabled:opacity-60",
              storeStatus.isClosed || (mode === "entrega" && outsideRadius) || belowMinInvoice
                ? "bg-white/10 ring-1 ring-white/15"
                : "bg-neon-pink",
            )}
          >
            {(sending || authLoading) && <Loader2 className="h-4 w-4 animate-spin" />}
            {sending ? (
              "Criando pedido…"
            ) : authLoading ? (
              "Preparando checkout…"
            ) : belowMinInvoice ? (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                Mínimo {brl(MIN_INVOICE_BRL)} · retire na loja
              </>
            ) : storeStatus.isClosed ? (
              <>
                <MoonStar className="h-4 w-4 text-red-300" />
                {STORE_COPY.closedButtonLabel(storeStatus)}
              </>
            ) : mode === "entrega" && outsideRadius ? (
              <>
                <AlertTriangle className="h-4 w-4 text-red-300" />
                Endereço fora do raio de entrega
              </>
            ) : isAuthenticated ? (
              <>
                {paymentMethod !== "whatsapp" && <Lock className="h-4 w-4" />}
                {paymentMethod === "pix"
                  ? `Pagar ${brl(total)} com PIX`
                  : paymentMethod === "cartao"
                    ? `Pagar ${brl(total)} no cartão`
                    : paymentMethod === "asaas_checkout"
                      ? `Continuar · ${brl(total)}`
                      : `Enviar no WhatsApp · ${brl(total)}`}
              </>
            ) : (
              `Entrar para finalizar · ${brl(total)}`
            )}
          </button>
          {!storeStatus.isClosed && !(mode === "entrega" && outsideRadius) && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[10.5px] font-semibold text-white/60">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              <span>Pagamento criptografado · Sem taxas escondidas</span>
            </div>
          )}
        </div>
      </div>

      <AddressMapPicker
        open={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        initial={{
          lat: preGeocoded?.lat ?? quote?.lat ?? null,
          lng: preGeocoded?.lng ?? quote?.lng ?? null,
          address: address || preGeocoded?.address || null,
        }}
        storeOrigin={{ lat: originLat, lng: originLng }}
        onConfirm={(loc) => {
          const p = parseAddressParts(loc.address);
          const nextAddress = joinAddressParts({
            street: p.street || addrStreet,
            number: p.number || addrNumber,
            neighborhood: p.neighborhood || addrNeighborhood,
            city: p.city || addrCity,
          }) || loc.address;
          if (p.street) setAddrStreet(p.street);
          if (p.number) setAddrNumber(p.number);
          if (p.neighborhood) setAddrNeighborhood(p.neighborhood);
          if (p.city) setAddrCity(p.city);
          setAddress(nextAddress);
          setPreGeocoded({ lat: loc.lat, lng: loc.lng, address: nextAddress });
          // Immediately update the quote with real coords + distance if we know the store origin
          if (originLat != null && originLng != null) {
            const km = haversineKm(
              { lat: originLat, lng: originLng },
              { lat: loc.lat, lng: loc.lng },
            );
            setQuote({ lat: loc.lat, lng: loc.lng, km, label: nextAddress });
          }
          setSelectedAddressId(null);
          setMapPickerOpen(false);
          toast.success("Pin confirmado");
        }}
      />
    </div>
  );
}

function IconField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  name,
  type,
  inputMode,
  trailing,
}: {
  icon: any;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  name?: string;
  type?: string;
  inputMode?: "text" | "tel" | "email" | "numeric" | "search" | "url" | "none" | "decimal";
  trailing?: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 focus-within:border-neon-cyan/60 transition">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white/80">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wide text-white/60">{label}</div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          name={name}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
        />
      </div>
      {trailing}
    </label>
  );
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-extrabold transition",
        active ? "border border-neon-cyan bg-neon-cyan/10 text-white glow-cyan" : "text-white/70",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function buildMessage(o: {
  items: CartItem[];
  name: string;
  phone: string;
  address: string;
  reference: string;
  note: string;
  mode: Mode;
  fee: number;
  total: number;
  coupon: { code: string; discount: number } | null;
}) {
  const L: string[] = [];
  L.push("*🍧 NOVO PEDIDO — QUERO BIS*");
  L.push("");
  L.push(`👤 *Cliente:* ${o.name}`);
  L.push(`📱 *Telefone:* ${o.phone}`);
  L.push(`🚚 *Tipo:* ${o.mode === "entrega" ? "Entrega" : "Retirada na loja"}`);
  if (o.mode === "entrega") {
    L.push(`📍 *Endereço:* ${o.address}`);
    if (o.reference) L.push(`🧭 *Referência:* ${o.reference}`);
  }
  L.push("");
  L.push("*🛒 ITENS DO PEDIDO*");
  o.items.forEach((it, i) => {
    L.push(`\n${i + 1}. *${it.quantity}× ${it.name}*`);
    if (it.size) L.push(`   • Tamanho: ${it.size}`);
    if (it.flavor) L.push(`   • Sabor: ${it.flavor}`);
    if (it.extras.length) L.push(`   • Adicionais: ${it.extras.map((e) => e.label).join(", ")}`);
    if (it.removed.length) L.push(`   • Remover: ${it.removed.join(", ")}`);
    if (it.note) L.push(`   • Obs: ${it.note}`);
    L.push(`   • Subtotal: ${brl(it.unitPrice * it.quantity)}`);
  });
  L.push("");
  if (o.fee > 0) L.push(`Taxa de entrega: ${brl(o.fee)}`);
  if (o.coupon) L.push(`🎟️ Cupom ${o.coupon.code}: −${brl(o.coupon.discount)}`);
  L.push(`*TOTAL: ${brl(o.total)}*`);
  if (o.note) {
    L.push("");
    L.push(`📝 *Observação geral:* ${o.note}`);
  }
  L.push("");
  L.push("_Pedido enviado pelo cardápio digital 🍨_");
  return L.join("\n");
}
