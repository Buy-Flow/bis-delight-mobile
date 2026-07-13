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
import { CheckoutUpsellStrip } from "@/components/menu/CheckoutUpsellStrip";
import { useStoreStatus } from "@/lib/store-status";
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
import { MoonStar, Clock as ClockIcon, Home, Briefcase, Star, Navigation, Mail } from "lucide-react";


type Mode = "entrega" | "retirada";

const STORAGE_KEY = "querobis:customer";

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
  } catch {
    return {};
  }
}

function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

function parseAddressParts(full: string): { street: string; number: string; neighborhood: string; city: string } {
  const s = (full || "").trim();
  if (!s) return { street: "", number: "", neighborhood: "", city: "" };
  const [left, rightRaw] = s.includes("—") ? s.split("—") : s.includes(" - ") ? s.split(" - ") : [s, ""];
  const leftParts = left.split(",").map((x) => x.trim()).filter(Boolean);
  let street = leftParts[0] ?? "";
  let number = "";
  if (leftParts[1] && /^\d/.test(leftParts[1])) number = leftParts[1];
  else if (leftParts[1]) street = `${street}, ${leftParts[1]}`;
  const right = (rightRaw || leftParts.slice(2).join(", ")).trim();
  const rightParts = right.split(",").map((x) => x.trim()).filter(Boolean);
  return { street, number, neighborhood: rightParts[0] ?? "", city: rightParts.slice(1).join(", ") };
}

function joinAddressParts(p: { street: string; number: string; neighborhood: string; city: string }): string {
  const left = [p.street.trim(), p.number.trim()].filter(Boolean).join(", ");
  const right = [p.neighborhood.trim(), p.city.trim()].filter(Boolean).join(", ");
  return [left, right].filter(Boolean).join(" — ");
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
  const [sending, setSending] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ id: string; code: string; discount: number; kind: "loyalty" | "promo" } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

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



  useEffect(() => {
    if (!isCheckoutOpen) return;
    const saved = loadSaved();
    if (saved.name && !name) setName(saved.name);
    if (saved.phone && !phone) setPhone(saved.phone);
    if (saved.address && !address) setAddress(saved.address);
    if (saved.reference && !reference) setReference(saved.reference);

    if (user) {
      supabase
        .from("profiles")
        .select("full_name, phone, address, reference")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          // Profile is authoritative when logged in — overwrite cached values
          // so phone/name edits in "Dados pessoais" propagate everywhere.
          if (data.full_name) setName(data.full_name);
          if (data.phone) setPhone(data.phone);
          if (data.address && !address) setAddress(data.address);
          if (data.reference && !reference) setReference(data.reference);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckoutOpen, user?.id]);


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
  const discount = couponApplied?.discount ?? 0;
  const total = Math.max(0, subtotal + fee - discount);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

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
        const row = promo[0] as { id: string; code: string; discount: number };
        setCouponApplied({ id: row.id, code: row.code, discount: Number(row.discount), kind: "promo" });
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
        setCouponApplied({ id: row.id, code: row.code, discount: discountValue, kind: "loyalty" });
        toast.success(`Cupom aplicado! −${brl(discountValue)}`);
        return;
      }

      // Mensagem específica do erro do RPC promocional
      const msg = promoErr?.message ?? "";
      if (msg.includes("order_below_minimum")) toast.error("Pedido abaixo do mínimo pra este cupom.");
      else if (msg.includes("coupon_expired")) toast.error("Cupom expirado.");
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
    navigate({ to: "/auth", search: { next: "/" } as never });
  };

  const send = async () => {
    if (storeStatus.isClosed) {
      toast.error(
        storeStatus.nextOpenLabel
          ? `Loja fechada. Reabrimos ${storeStatus.nextOpenLabel}.`
          : "A loja está fechada no momento.",
      );
      return;
    }
    if (!isAuthenticated || !user) {
      goLogin();
      return;
    }
    if (!name.trim() || !phone.trim() || (mode === "entrega" && !address.trim())) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    if (mode === "entrega" && outsideRadius) {
      toast.error(
        zone?.outsideMessage ||
          "Endereço fora do nosso raio de entrega. Tente retirada na loja.",
      );
      return;
    }
    setSending(true);
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
          distance_km: mode === "entrega" && quote ? Number(quote.km.toFixed(3)) : null,
          delivery_lat: mode === "entrega" && quote ? quote.lat : null,
          delivery_lng: mode === "entrega" && quote ? quote.lng : null,
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;

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
      } catch {}

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

      const msg = buildMessage({ items, name, phone, address, reference, note, mode, fee, total, coupon: couponApplied ? { code: couponApplied.code, discount: couponApplied.discount } : null });
      const url = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
      toast.success("Pedido enviado! Você ganhou 1 selo Bis Recompensa 🍧");
      setTimeout(() => {
        clear();
        closeCheckout();
      }, 400);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar o pedido. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={pageMode ? "min-h-dvh card-acai" : "fixed inset-0 z-50"}>
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
                    {storeStatus.reason === "override-closed"
                      ? "Estamos temporariamente fechados"
                      : "Loja fechada no momento"}
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
                  return (
                    <>
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

                <button
                  type="button"
                  onClick={() => setMapPickerOpen(true)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-[12px] font-bold transition",
                    preGeocoded
                      ? "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Route className="h-4 w-4" />
                    {preGeocoded ? "Pin ajustado no mapa" : "Ajustar pin no mapa"}
                  </span>
                  <span className="text-[10px] font-normal opacity-70">
                    {preGeocoded
                      ? `${preGeocoded.lat.toFixed(4)}, ${preGeocoded.lng.toFixed(4)}`
                      : "endereço exato"}
                  </span>
                </button>

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
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-neon-cyan/15 text-neon-cyan">
                <Ticket className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-white">Cupom de desconto</div>
                <div className="text-[11px] text-white/60">Tem um código Bis Recompensa? Use aqui.</div>
              </div>
            </div>
            {couponApplied ? (
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Check className="h-4 w-4 text-neon-cyan shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">{couponApplied.code}</div>
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
            ) : (
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
            )}
          </div>


          <div className="h-20" />

          <button type="submit" className="sr-only" aria-hidden>Enviar</button>
        </form>

        <div className={pageMode ? "px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]" : "border-t border-white/10 bg-[oklch(0.14_0.09_305)]/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"}>
          <button
            onClick={send}
            disabled={
              sending ||
              authLoading ||
              storeStatus.isClosed ||
              (mode === "entrega" && outsideRadius)
            }
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-extrabold text-white active:scale-[.98] disabled:opacity-60",
              storeStatus.isClosed || (mode === "entrega" && outsideRadius)
                ? "bg-white/10 ring-1 ring-white/15"
                : "bg-neon-pink",
            )}
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            {storeStatus.isClosed ? (
              <>
                <MoonStar className="h-4 w-4 text-red-300" />
                {storeStatus.nextOpenLabel
                  ? `Fechado · reabrimos ${storeStatus.nextOpenLabel}`
                  : "Loja fechada no momento"}
              </>
            ) : mode === "entrega" && outsideRadius ? (
              <>
                <AlertTriangle className="h-4 w-4 text-red-300" />
                Endereço fora do raio de entrega
              </>
            ) : isAuthenticated ? (
              `Enviar pedido no WhatsApp · ${brl(total)}`
            ) : (
              `Entrar para finalizar · ${brl(total)}`
            )}
          </button>
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
