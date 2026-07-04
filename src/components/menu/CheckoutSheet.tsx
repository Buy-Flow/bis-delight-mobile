import { useState } from "react";
import { X, Truck, Store } from "lucide-react";
import { brl, useCart, type CartItem } from "@/lib/cart-context";
import { BRAND } from "@/data/menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "entrega" | "retirada";

export function CheckoutSheet() {
  const { isCheckoutOpen, closeCheckout, items, subtotal, clear } = useCart();
  const [mode, setMode] = useState<Mode>("entrega");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  if (!isCheckoutOpen) return null;

  const fee = mode === "entrega" ? BRAND.deliveryFee : 0;
  const total = subtotal + fee;

  const send = () => {
    if (!name.trim() || !phone.trim() || (mode === "entrega" && !address.trim())) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    const msg = buildMessage({ items, name, phone, address, reference, note, mode, fee, total });
    const url = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    toast.success("Pedido enviado! Abrindo WhatsApp…");
    setTimeout(() => {
      clear();
      closeCheckout();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={closeCheckout} />
      <div className="absolute inset-x-0 bottom-0 top-[6vh] flex flex-col overflow-hidden rounded-t-[28px] card-acai animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div>
            <h3 className="font-display text-xl font-extrabold text-white">Finalizar pedido</h3>
            <p className="text-[11px] text-white/60">Envie direto pro WhatsApp da loja</p>
          </div>
          <button onClick={closeCheckout} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
          <div>
            <h4 className="mb-2 font-display text-[15px] font-extrabold uppercase tracking-wide text-white">
              Como quer receber?
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <ModeBtn active={mode === "entrega"} onClick={() => setMode("entrega")} icon={Truck} label="Entrega" sub={brl(BRAND.deliveryFee)} />
              <ModeBtn active={mode === "retirada"} onClick={() => setMode("retirada")} icon={Store} label="Retirada" sub="Grátis" />
            </div>
          </div>

          <Field label="Seu nome *" value={name} onChange={setName} placeholder="Como te chamamos?" />
          <Field label="Telefone *" value={phone} onChange={setPhone} placeholder="(69) 9 9999-9999" />
          {mode === "entrega" && (
            <>
              <Field label="Endereço *" value={address} onChange={setAddress} placeholder="Rua, número, bairro" />
              <Field label="Ponto de referência" value={reference} onChange={setReference} placeholder="Próximo a…" />
            </>
          )}
          <Field label="Observação do pedido" value={note} onChange={setNote} placeholder="Alguma preferência?" multiline />

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <h4 className="mb-2 font-display text-[13px] font-extrabold uppercase tracking-wide text-white">
              Resumo
            </h4>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.uid} className="flex justify-between gap-2 text-[13px]">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">
                      {it.quantity}× {it.name}
                    </div>
                    <div className="truncate text-[11px] text-white/60">
                      {[it.size, it.flavor].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="whitespace-nowrap font-bold text-neon-yellow">
                    {brl(it.unitPrice * it.quantity)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm">
              <div className="flex justify-between text-white/70">
                <span>Subtotal</span>
                <span>{brl(subtotal)}</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>{mode === "entrega" ? "Taxa de entrega" : "Retirada na loja"}</span>
                <span>{fee > 0 ? brl(fee) : "Grátis"}</span>
              </div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-[11px] uppercase tracking-widest text-white/50">Total</span>
                <span className="font-display text-2xl font-extrabold text-neon-yellow glow-yellow-text">
                  {brl(total)}
                </span>
              </div>
            </div>
          </div>
          <div className="h-20" />
        </div>

        <div className="border-t border-white/10 bg-[oklch(0.14_0.09_305)]/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={send}
            className="w-full rounded-2xl bg-neon-pink px-4 py-4 text-base font-extrabold text-white glow-pink active:scale-[.98]"
          >
            Enviar pedido no WhatsApp · {brl(total)}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
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
