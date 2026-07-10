import { useEffect, useState } from "react";
import { X, Truck, Store, Sparkles, LogIn, Loader2, User, Phone, MapPin, Settings, MessageCircle, Heart, Plus, Minus, ShoppingBag, Ticket, Check } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { brl, useCart, type CartItem } from "@/lib/cart-context";
import { BRAND } from "@/data/menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useBackDismiss } from "@/lib/use-back-dismiss";
import { notifyCRM } from "@/lib/crm";

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

export function CheckoutSheet() {
  const { isCheckoutOpen, closeCheckout, items, update, subtotal, clear } = useCart();
  useBackDismiss(isCheckoutOpen, closeCheckout);
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("entrega");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ id: string; code: string; discount: number; kind: "loyalty" | "promo" } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

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
          if (data.full_name && !name) setName(data.full_name);
          if (data.phone && !phone) setPhone(data.phone);
          if (data.address && !address) setAddress(data.address);
          if (data.reference && !reference) setReference(data.reference);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckoutOpen, user?.id]);

  if (!isCheckoutOpen) return null;

  const fee = mode === "entrega" ? BRAND.deliveryFee : 0;
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
      const row = Array.isArray(data) ? data[0] : null;
      if (row) {
        const REWARD_VALUE = 20;
        if (subtotal < REWARD_VALUE) {
          toast.error(`Pedido mínimo de ${brl(REWARD_VALUE)} para usar este cupom.`);
          return;
        }
        const discountValue = Math.min(REWARD_VALUE, subtotal);
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
    if (!isAuthenticated || !user) {
      goLogin();
      return;
    }
    if (!name.trim() || !phone.trim() || (mode === "entrega" && !address.trim())) {
      toast.error("Preencha os campos obrigatórios.");
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

      notifyCRM("order_placed", {
        order_id: order.id,
        user_id: user.id,
        customer_name: name.trim(),
        phone: phone.trim(),
        address: mode === "entrega" ? address.trim() : null,
        mode,
        subtotal,
        delivery_fee: fee,
        total,
        coupon_code: couponApplied?.code ?? null,
        items: items.map((it) => ({
          product_id: it.productId,
          name: it.name,
          size: it.size ?? null,
          flavor: it.flavor ?? null,
          quantity: it.quantity,
          unit_price: it.unitPrice,
        })),
      });

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
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={closeCheckout} />
      <div className="absolute inset-x-0 bottom-0 top-[6vh] flex flex-col overflow-hidden rounded-t-[28px] card-acai animate-in slide-in-from-bottom duration-300">
        {/* Close button */}
        <button
          onClick={closeCheckout}
          className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur"
        >
          <X className="h-5 w-5" />
        </button>

        <form
          className="flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-6"
          autoComplete="on"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {/* Header simples com detalhe */}
          <div className="-mx-4 -mt-6 px-5 pb-4 pt-6 pr-16">
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
                <IconField
                  icon={MapPin}
                  label="Endereço"
                  value={address}
                  onChange={setAddress}
                  placeholder="Rua, número, bairro"
                  autoComplete="street-address"
                  name="street-address"
                  trailing={<div className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80"><Settings className="h-4 w-4" /></div>}
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

        <div className="border-t border-white/10 bg-[oklch(0.14_0.09_305)]/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={send}
            disabled={sending || authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-4 text-base font-extrabold text-white glow-pink active:scale-[.98] disabled:opacity-60"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAuthenticated ? `Enviar pedido no WhatsApp · ${brl(total)}` : `Entrar para finalizar · ${brl(total)}`}
          </button>
        </div>
      </div>
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
