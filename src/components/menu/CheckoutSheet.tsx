import { useEffect, useState } from "react";
import { X, Truck, Store, Sparkles, LogIn, Loader2 } from "lucide-react";
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
  const { isCheckoutOpen, closeCheckout, items, subtotal, clear } = useCart();
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

  // Pré-carrega dados salvos + do perfil quando abre
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

    // Se logado, tenta puxar do perfil
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
      // Save order to DB
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

      // Update profile with latest info for future orders
      await supabase.from("profiles").upsert({
        id: user.id,
        full_name: name.trim(),
        phone: phone.trim(),
        address: address.trim() || null,
        reference: reference.trim() || null,
      });

      // Save locally too
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ name: name.trim(), phone: phone.trim(), address: address.trim(), reference: reference.trim() }),
        );
      } catch {}

      // Open WhatsApp
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
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={closeCheckout} />
      <div className="absolute inset-x-0 bottom-0 top-[6vh] flex flex-col overflow-hidden rounded-t-[28px] card-acai animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div>
            <h3 className="font-display text-xl font-extrabold text-white">Finalizar pedido</h3>
            <p className="text-[11px] text-white/60">
              {isAuthenticated ? "Envie direto pro WhatsApp da loja" : "Entre para finalizar e acumular selos"}
            </p>
          </div>
          <button onClick={closeCheckout} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="flex-1 space-y-5 overflow-y-auto px-4 py-5"
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

          <div>
            <h4 className="mb-2 font-display text-[15px] font-extrabold uppercase tracking-wide text-white">
              Como quer receber?
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <ModeBtn active={mode === "entrega"} onClick={() => setMode("entrega")} icon={Truck} label="Entrega" sub={brl(BRAND.deliveryFee)} />
              <ModeBtn active={mode === "retirada"} onClick={() => setMode("retirada")} icon={Store} label="Retirada" sub="Grátis" />
            </div>
          </div>

          {hasSaved && (
            <button
              type="button"
              onClick={fillFromSaved}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neon-cyan/50 bg-neon-cyan/10 px-3 py-3 text-sm font-bold text-neon-cyan active:scale-[.98]"
            >
              <Sparkles className="h-4 w-4" />
              Preencher com meus dados salvos
            </button>
          )}

          <Field label="Seu nome *" value={name} onChange={setName} placeholder="Como te chamamos?" autoComplete="name" name="name" />
          <Field label="Telefone *" value={phone} onChange={(v) => setPhone(formatPhone(v))} placeholder="(69) 9 9999-9999" autoComplete="tel" name="tel" type="tel" inputMode="tel" />
          {mode === "entrega" && (
            <>
              <Field label="Endereço *" value={address} onChange={setAddress} placeholder="Rua, número, bairro" autoComplete="street-address" name="street-address" />
              <Field label="Ponto de referência" value={reference} onChange={setReference} placeholder="Próximo a…" autoComplete="address-line2" name="address-line2" />
            </>
          )}
          <Field label="Observação do pedido" value={note} onChange={setNote} placeholder="Alguma preferência?" multiline autoComplete="off" />

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <h4 className="mb-2 font-display text-[13px] font-extrabold uppercase tracking-wide text-white">Resumo</h4>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.uid} className="flex justify-between gap-2 text-[13px]">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{it.quantity}× {it.name}</div>
                    <div className="truncate text-[11px] text-white/60">{[it.size, it.flavor].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="whitespace-nowrap font-bold text-neon-yellow">{brl(it.unitPrice * it.quantity)}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm">
              <div className="flex justify-between text-white/70"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
              <div className="flex justify-between text-white/70"><span>{mode === "entrega" ? "Taxa de entrega" : "Retirada na loja"}</span><span>{fee > 0 ? brl(fee) : "Grátis"}</span></div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-[11px] uppercase tracking-widest text-white/50">Total</span>
                <span className="font-display text-2xl font-extrabold text-neon-yellow glow-yellow-text">{brl(total)}</span>
              </div>
            </div>
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  autoComplete,
  name,
  type,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoComplete?: string;
  name?: string;
  type?: string;
  inputMode?: "text" | "tel" | "email" | "numeric" | "search" | "url" | "none" | "decimal";
}) {
  const Comp: any = multiline ? "textarea" : "input";
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-white/80">{label}</span>
      <Comp
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-cyan"
      />
    </label>
  );
}

function ModeBtn({
  active,
  onClick,
  icon: Icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
        active ? "border-neon-cyan bg-neon-cyan/10 glow-cyan" : "border-white/10 bg-white/5",
      )}
    >
      <div className={cn("grid h-10 w-10 place-items-center rounded-xl", active ? "bg-neon-cyan text-[oklch(0.18_0.11_305)]" : "bg-white/10 text-white")}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-bold text-white">{label}</div>
        <div className="text-[11px] text-white/60">{sub}</div>
      </div>
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
