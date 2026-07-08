import { useEffect, useState, type ComponentType } from "react";
import {
  X,
  Sparkles,
  LogIn,
  Loader2,
  Heart,
  ShoppingBag,
  Bike,
  User as UserIcon,
  Phone,
  MapPin,
  Map as MapIcon,
  MessageSquare,
  Receipt,
  Settings,
  MessageCircle,
  Minus,
  Plus,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { brl, useCart, type CartItem } from "@/lib/cart-context";
import { BRAND } from "@/data/menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

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
  const { isCheckoutOpen, closeCheckout, items, subtotal, update, clear } = useCart();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("entrega");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [hasSaved, setHasSaved] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isCheckoutOpen) return;
    const saved = loadSaved();
    const any = !!(saved.name || saved.phone || saved.address);
    setHasSaved(any);
    if (any) {
      if (saved.name && !name) setName(saved.name);
      if (saved.phone && !phone) setPhone(saved.phone);
      if (saved.address && !address) setAddress(saved.address);
      if (saved.reference && !reference) setReference(saved.reference);
    }
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
  const total = subtotal + fee;
  const itemsCount = items.reduce((s, i) => s + i.quantity, 0);

  const fillFromSaved = () => {
    const s = loadSaved();
    if (!s.name && !s.phone && !s.address) {
      toast.info("Nenhum dado salvo ainda.");
      return;
    }
    setName(s.name || "");
    setPhone(s.phone || "");
    setAddress(s.address || "");
    setReference(s.reference || "");
    toast.success("Dados preenchidos!");
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
          JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
            reference: reference.trim(),
          }),
        );
      } catch {}

      const msg = buildMessage({ items, name, phone, address, reference, note, mode, fee, total });
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
    <div className="fixed inset-0 z-50 [-webkit-tap-highlight-color:transparent]">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={closeCheckout}
      />
      <div className="absolute inset-x-0 bottom-0 top-[6vh] flex flex-col overflow-hidden rounded-t-[28px] card-acai animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="relative shrink-0 px-4 pt-5 pb-4">
          <button
            onClick={closeCheckout}
            aria-label="Fechar"
            className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 pr-12">
            <Sparkles className="h-5 w-5 text-neon-yellow animate-spin-slow" strokeWidth={2.5} />
            <h3 className="font-display text-[26px] font-black leading-none text-white">
              Finalizar pedido
            </h3>
            <Sparkles
              className="h-5 w-5 text-neon-yellow animate-spin-slow"
              strokeWidth={2.5}
              style={{ animationDirection: "reverse" }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[13px] text-white/70">
            <span>Falta pouco para a</span>
            <span className="font-semibold text-neon-pink">felicidade</span>
            <span>chegar!</span>
            <Heart className="h-3.5 w-3.5 fill-neon-pink text-neon-pink animate-heartbeat" />
          </div>
        </div>

        <form
          className="flex-1 space-y-4 overflow-y-auto px-4 pb-6"
          autoComplete="on"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {!authLoading && !isAuthenticated && (
            <div className="rounded-2xl border border-neon-yellow/40 bg-neon-yellow/10 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-neon-yellow" />
                <div className="flex-1">
                  <div className="text-sm font-extrabold text-neon-yellow">
                    Entre para finalizar seu pedido
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-white/70">
                    A cada pedido você ganha 1 selo Bis Recompensa. 10 selos = 1 açaí 300ml grátis!
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

          {/* Toggle Retirada / Entrega */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5">
            <ModePill
              active={mode === "retirada"}
              onClick={() => setMode("retirada")}
              icon={ShoppingBag}
              label="Retirada"
            />
            <ModePill
              active={mode === "entrega"}
              onClick={() => setMode("entrega")}
              icon={Bike}
              label="Entrega"
            />
          </div>

          {hasSaved && (
            <button
              type="button"
              onClick={fillFromSaved}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-2.5 text-[13px] font-bold text-neon-cyan active:scale-[.98]"
            >
              <Sparkles className="h-4 w-4" />
              Preencher com meus dados salvos
            </button>
          )}

          <IconField
            icon={UserIcon}
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
            rightIcon={MessageCircle}
            rightIconTint="cyan"
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
                rightIcon={Settings}
              />
              <IconField
                icon={MapIcon}
                label="Referência"
                value={reference}
                onChange={setReference}
                placeholder="Ex: Próximo a igreja, mercado, etc."
                autoComplete="address-line2"
                name="address-line2"
              />
            </>
          )}
          <IconField
            icon={MessageSquare}
            label="Observação"
            value={note}
            onChange={setNote}
            placeholder="Alguma observação do pedido? (opcional)"
            autoComplete="off"
            multiline
          />

          {/* Resumo */}
          <div className="rounded-2xl border border-white/10 bg-[oklch(0.16_0.10_305)]/60 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-white">
                  <Receipt className="h-4 w-4" />
                </div>
                <span className="font-display text-[15px] font-extrabold uppercase tracking-wide text-white">
                  Resumo
                </span>
              </div>
              {itemsCount > 0 && (
                <span className="rounded-full bg-neon-pink/20 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-neon-pink ring-1 ring-neon-pink/40">
                  {itemsCount} {itemsCount === 1 ? "item" : "itens"}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {items.map((it) => (
                <div
                  key={it.uid}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[oklch(0.24_0.14_305)]">
                    <img
                      src={it.image}
                      alt={it.name}
                      className="h-full w-full object-contain p-0.5"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-white">{it.name}</div>
                    {(it.extras.length > 0 || it.removed.length > 0 || it.size || it.flavor) && (
                      <div className="truncate text-[11px] text-white/60">
                        {[
                          [it.size, it.flavor].filter(Boolean).join(" · "),
                          it.extras.map((e) => e.label).join(", "),
                          it.removed.length ? `sem ${it.removed.join(", ")}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                    <button
                      type="button"
                      onClick={() =>
                        update(it.uid, { quantity: Math.max(1, it.quantity - 1) })
                      }
                      aria-label="Diminuir"
                      className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white active:scale-95"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-4 text-center text-[13px] font-bold text-white">
                      {it.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => update(it.uid, { quantity: it.quantity + 1 })}
                      aria-label="Aumentar"
                      className="grid h-6 w-6 place-items-center rounded-full bg-neon-cyan text-[oklch(0.18_0.11_305)] active:scale-95"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="w-16 shrink-0 text-right font-display text-[13px] font-extrabold text-neon-pink">
                    {brl(it.unitPrice * it.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {fee > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[12px] text-white/70">
                <span>Taxa de entrega</span>
                <span>{brl(fee)}</span>
              </div>
            )}

            <div
              className={cn(
                "flex items-baseline justify-between",
                fee > 0 ? "mt-2" : "mt-3 border-t border-white/10 pt-3",
              )}
            >
              <span className="font-display text-[18px] font-extrabold uppercase tracking-wide text-white">
                Total
              </span>
              <span className="font-display text-3xl font-black text-neon-yellow glow-yellow-text">
                {brl(total)}
              </span>
            </div>
          </div>

          <div className="h-16" />
          <button type="submit" className="sr-only" aria-hidden>
            Enviar
          </button>
        </form>

        <div className="border-t border-white/10 bg-[oklch(0.14_0.09_305)]/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={send}
            disabled={sending || authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-4 text-base font-extrabold text-white glow-pink active:scale-[.98] disabled:opacity-60"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAuthenticated
              ? `Enviar pedido no WhatsApp · ${brl(total)}`
              : `Entrar para finalizar · ${brl(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModePill({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition",
        active
          ? "bg-[oklch(0.20_0.13_305)] text-neon-cyan ring-2 ring-neon-cyan glow-cyan"
          : "text-white/70 hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2.4} />
      {label}
    </button>
  );
}

function IconField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  multiline,
  autoComplete,
  name,
  type,
  inputMode,
  rightIcon: RightIcon,
  rightIconTint = "white",
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoComplete?: string;
  name?: string;
  type?: string;
  inputMode?: "text" | "tel" | "email" | "numeric" | "search" | "url" | "none" | "decimal";
  rightIcon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  rightIconTint?: "white" | "cyan";
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 transition focus-within:border-neon-cyan/60">
      <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-white/80">
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
          {label}
        </div>
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={2}
            name={name}
            autoComplete={autoComplete}
            className="w-full resize-none bg-transparent text-[14px] text-white placeholder:text-white/40 outline-none"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            name={name}
            type={type}
            inputMode={inputMode}
            autoComplete={autoComplete}
            className="w-full bg-transparent text-[14px] text-white placeholder:text-white/40 outline-none"
          />
        )}
      </div>
      {RightIcon && (
        <div
          className={cn(
            "mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
            rightIconTint === "cyan"
              ? "bg-neon-cyan/15 text-neon-cyan ring-1 ring-neon-cyan/30"
              : "bg-white/5 text-white/70",
          )}
        >
          <RightIcon className="h-4 w-4" strokeWidth={2.2} />
        </div>
      )}
    </div>
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
  L.push(`*TOTAL: ${brl(o.total)}*`);
  if (o.note) {
    L.push("");
    L.push(`📝 *Observação geral:* ${o.note}`);
  }
  L.push("");
  L.push("_Pedido enviado pelo cardápio digital 🍨_");
  return L.join("\n");
}
