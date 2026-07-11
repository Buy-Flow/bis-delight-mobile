import { useMemo, useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Banknote,
  CreditCard,
  QrCode,
  Wallet,
  Printer,
  Store,
  Truck,
  X,
  StickyNote,
  UserRound,
  Phone,
  MapPin,
  Check,
  Sparkles,
  Pencil,
} from "lucide-react";
import { useProducts, useCategories } from "@/lib/menu-data";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/data/menu";
import type { CartItem } from "@/lib/cart-context";
import { ProductModal } from "@/components/menu/ProductModal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pdv")({
  head: () => ({
    meta: [
      { title: "PDV — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PDVPage,
});

type PaymentMethod = "dinheiro" | "pix" | "debito" | "credito";

/**
 * PDV cart line — mirrors the customer CartItem shape so the same
 * ProductModal can push into it. Includes extras, removed items,
 * per-line notes and image for a fully-customized order.
 */
type CartLine = {
  uid: string;
  productId: string;
  name: string;
  image: string;
  size?: string;
  flavor?: string;
  extras: { label: string; price: number }[];
  removed: string[];
  note?: string;
  quantity: number;
  unitPrice: number;
};

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PAYMENTS: { id: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dinheiro", label: "Dinheiro", icon: Banknote },
  { id: "pix", label: "PIX", icon: QrCode },
  { id: "debito", label: "Débito", icon: CreditCard },
  { id: "credito", label: "Crédito", icon: Wallet },
];

function PDVPage() {
  const { user } = useAuth();
  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategories();

  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [mode, setMode] = useState<"retirada" | "entrega">("retirada");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<string>("0");
  const [discountType, setDiscountType] = useState<"reais" | "percent">("reais");
  const [discountValue, setDiscountValue] = useState("0");
  const [payment, setPayment] = useState<PaymentMethod>("dinheiro");
  const [cashReceived, setCashReceived] = useState("");
  const [note, setNote] = useState("");
  const [selecting, setSelecting] = useState<Product | null>(null);
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  const [sending, setSending] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (p.active === false) return false;
      if (category !== "all" && p.category !== category) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [products, category, search]);

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [cart],
  );
  const fee = mode === "entrega" ? Math.max(0, Number(deliveryFee) || 0) : 0;
  const discountRaw = Number(discountValue) || 0;
  const discount =
    discountType === "percent"
      ? (subtotal * Math.min(100, Math.max(0, discountRaw))) / 100
      : Math.min(subtotal, Math.max(0, discountRaw));
  const total = Math.max(0, subtotal - discount + fee);
  const cashNum = Number(cashReceived) || 0;
  const change = payment === "dinheiro" ? Math.max(0, cashNum - total) : 0;
  const missing = payment === "dinheiro" && cashNum > 0 && cashNum < total ? total - cashNum : 0;

  const addFromModal = (payload: Omit<CartItem, "uid">, isEdit: boolean) => {
    if (isEdit && editingLine) {
      setCart((prev) =>
        prev.map((l) => (l.uid === editingLine.uid ? { ...payload, uid: editingLine.uid } : l)),
      );
    } else {
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setCart((prev) => [...prev, { ...payload, uid }]);
      setShowMobileCart(true);
    }
    setSelecting(null);
    setEditingLine(null);
  };

  const onProductClick = (p: Product) => {
    setEditingLine(null);
    setSelecting(p);
  };

  const onEditLine = (line: CartLine) => {
    const p = products.find((pp) => pp.id === line.productId);
    if (!p) {
      toast.error("Produto não encontrado no catálogo.");
      return;
    }
    setEditingLine(line);
    setSelecting(p);
  };

  const changeQty = (uid: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.uid === uid ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const removeLine = (uid: string) => setCart((prev) => prev.filter((l) => l.uid !== uid));

  const clearAll = () => {
    if (cart.length === 0) return;
    if (!confirm("Limpar toda a venda atual?")) return;
    resetSale();
  };

  const resetSale = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setAddress("");
    setDeliveryFee("0");
    setDiscountValue("0");
    setDiscountType("reais");
    setPayment("dinheiro");
    setCashReceived("");
    setNote("");
    setLastOrderId(null);
  };

  const finalize = async () => {
    if (!user) {
      toast.error("Sessão inválida.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Adicione ao menos um item.");
      return;
    }
    if (mode === "entrega" && !address.trim()) {
      toast.error("Informe o endereço da entrega.");
      return;
    }
    if (payment === "dinheiro" && cashNum > 0 && cashNum < total) {
      toast.error("Valor recebido insuficiente.");
      return;
    }
    setSending(true);
    try {
      const receiptNote = [
        `PDV · ${PAYMENTS.find((p) => p.id === payment)?.label}`,
        payment === "dinheiro" && cashNum > 0
          ? `Recebido ${BRL(cashNum)} · Troco ${BRL(change)}`
          : null,
        discount > 0
          ? `Desconto ${discountType === "percent" ? `${discountRaw}%` : BRL(discount)}`
          : null,
        note.trim() || null,
      ]
        .filter(Boolean)
        .join(" · ");

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          mode,
          customer_name: customerName.trim() || "Balcão",
          phone: customerPhone.trim() || "-",
          address: mode === "entrega" ? address.trim() : null,
          reference: null,
          note: receiptNote || null,
          subtotal,
          delivery_fee: fee,
          total,
          status: "pago",
          paid_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;

      const itemsPayload = cart.map((l) => ({
        order_id: order.id,
        product_id: l.productId,
        name: l.name,
        size: l.size,
        flavor: l.flavor,
        extras: l.extras,
        removed: l.removed,
        note: l.note || null,
        quantity: l.quantity,
        unit_price: l.unitPrice,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      setLastOrderId(order.id);
      toast.success("Venda registrada!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao finalizar: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  const printReceipt = () => {
    const html = buildReceiptHtml({
      orderId: lastOrderId ?? "",
      cart,
      subtotal,
      discount,
      fee,
      total,
      payment: PAYMENTS.find((p) => p.id === payment)?.label ?? payment,
      cashReceived: payment === "dinheiro" ? cashNum : 0,
      change: payment === "dinheiro" ? change : 0,
      mode,
      customerName: customerName.trim() || "Balcão",
      address: mode === "entrega" ? address.trim() : "",
    });
    const w = window.open("", "_blank", "width=380,height=640");
    if (!w) {
      toast.error("Ative pop-ups para imprimir.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <div className="mx-auto grid max-w-[1600px] gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Catalog */}
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto…  (tecla /)"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-pink/60"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-neon-yellow" />
              {filteredProducts.length} itens
            </div>
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition",
                    active
                      ? "border-neon-pink bg-neon-pink/20 text-white shadow-[0_0_20px_-4px_rgb(255_20_147/.6)]"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-white/25 hover:text-white",
                  )}
                >
                  {c.emoji} {c.name}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => onProductClick(p)}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:-translate-y-0.5 hover:border-neon-pink/50 hover:shadow-[0_10px_30px_-15px_rgb(255_20_147/.6)]"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-black/40">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-white/30">
                      <ShoppingCart className="h-8 w-8" />
                    </div>
                  )}
                  {p.pausedUntil && new Date(p.pausedUntil) > new Date() && (
                    <div className="absolute inset-0 grid place-items-center bg-black/60 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                      Pausado
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <div className="line-clamp-2 text-sm font-bold text-white">{p.name}</div>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-base font-black text-neon-yellow">
                      {BRL(p.basePrice)}
                    </span>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-neon-pink/20 text-neon-pink transition group-hover:bg-neon-pink group-hover:text-white">
                      <Plus className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-white/50">
                Nenhum produto encontrado.
              </div>
            )}
          </div>
        </section>

        {/* Cart panel — desktop */}
        <aside className="hidden lg:block">
          <CartPanel
            cart={cart}
            subtotal={subtotal}
            discount={discount}
            fee={fee}
            total={total}
            mode={mode}
            setMode={setMode}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            address={address}
            setAddress={setAddress}
            deliveryFee={deliveryFee}
            setDeliveryFee={setDeliveryFee}
            discountType={discountType}
            setDiscountType={setDiscountType}
            discountValue={discountValue}
            setDiscountValue={setDiscountValue}
            payment={payment}
            setPayment={setPayment}
            cashReceived={cashReceived}
            setCashReceived={setCashReceived}
            change={change}
            missing={missing}
            note={note}
            setNote={setNote}
            changeQty={changeQty}
            removeLine={removeLine}
            onEditLine={onEditLine}
            clearAll={clearAll}
            finalize={finalize}
            sending={sending}
          />
        </aside>
      </div>

      {/* Mobile floating cart button */}
      <button
        onClick={() => setShowMobileCart(true)}
        className={cn(
          "fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-neon-pink to-fuchsia-500 px-5 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgb(255_20_147/.7)] lg:hidden",
          cart.length === 0 && "opacity-70",
        )}
      >
        <ShoppingCart className="h-4 w-4" />
        {cartCount} {cartCount === 1 ? "item" : "itens"} · {BRL(total)}
      </button>

      {/* Mobile drawer */}
      {showMobileCart && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowMobileCart(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[oklch(0.11_0.06_300)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold text-white">Venda atual</div>
              <button
                onClick={() => setShowMobileCart(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CartPanel
              cart={cart}
              subtotal={subtotal}
              discount={discount}
              fee={fee}
              total={total}
              mode={mode}
              setMode={setMode}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              address={address}
              setAddress={setAddress}
              deliveryFee={deliveryFee}
              setDeliveryFee={setDeliveryFee}
              discountType={discountType}
              setDiscountType={setDiscountType}
              discountValue={discountValue}
              setDiscountValue={setDiscountValue}
              payment={payment}
              setPayment={setPayment}
              cashReceived={cashReceived}
              setCashReceived={setCashReceived}
              change={change}
              missing={missing}
              note={note}
              setNote={setNote}
              changeQty={changeQty}
              removeLine={removeLine}
              onEditLine={onEditLine}
              clearAll={clearAll}
              finalize={finalize}
              sending={sending}
              embedded
            />
          </div>
        </div>
      )}

      {/* Full-featured product customization (sizes, flavors, extras, notes, quantities) */}
      {selecting && (
        <ProductModal
          product={selecting}
          editItem={editingLine as CartItem | null}
          submitLabel={editingLine ? "Salvar" : "Adicionar"}
          onSubmit={addFromModal}
          onClose={() => {
            setSelecting(null);
            setEditingLine(null);
          }}
        />
      )}

      {/* Success dialog */}
      {lastOrderId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-emerald-400/30 bg-[oklch(0.13_0.05_300)] p-6 text-center shadow-[0_20px_60px_-20px_rgb(16_185_129/.5)]">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
              <Check className="h-8 w-8" />
            </div>
            <div className="text-lg font-black text-white">Venda concluída!</div>
            <div className="mt-1 text-xs text-white/60">
              Pedido #{lastOrderId.slice(0, 8).toUpperCase()} · {BRL(total)}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={printReceipt}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-bold text-white hover:bg-white/10"
              >
                <Printer className="h-4 w-4" /> Imprimir
              </button>
              <button
                onClick={resetSale}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-pink to-fuchsia-500 py-2.5 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" /> Nova venda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Cart Panel ---------------- */

type CartPanelProps = {
  cart: CartLine[];
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
  mode: "retirada" | "entrega";
  setMode: (v: "retirada" | "entrega") => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  deliveryFee: string;
  setDeliveryFee: (v: string) => void;
  discountType: "reais" | "percent";
  setDiscountType: (v: "reais" | "percent") => void;
  discountValue: string;
  setDiscountValue: (v: string) => void;
  payment: PaymentMethod;
  setPayment: (v: PaymentMethod) => void;
  cashReceived: string;
  setCashReceived: (v: string) => void;
  change: number;
  missing: number;
  note: string;
  setNote: (v: string) => void;
  changeQty: (uid: string, delta: number) => void;
  removeLine: (uid: string) => void;
  onEditLine: (line: CartLine) => void;
  clearAll: () => void;
  finalize: () => void;
  sending: boolean;
  embedded?: boolean;
};

function CartPanel(p: CartPanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-3xl border border-white/10 bg-[oklch(0.12_0.06_300)] p-4",
        !p.embedded && "sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto",
      )}
    >
      {/* Mode */}
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
        {(["retirada", "entrega"] as const).map((m) => {
          const active = p.mode === m;
          const Icon = m === "retirada" ? Store : Truck;
          return (
            <button
              key={m}
              onClick={() => p.setMode(m)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition",
                active
                  ? "bg-gradient-to-r from-neon-pink to-fuchsia-500 text-white"
                  : "text-white/60 hover:text-white",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {m === "retirada" ? "Balcão" : "Entrega"}
            </button>
          );
        })}
      </div>

      {/* Items */}
      <div className="space-y-2">
        {p.cart.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-8 text-center text-xs text-white/50">
            Toque em um produto para começar
          </div>
        ) : (
          p.cart.map((l) => {
            const meta = [l.size, l.flavor].filter(Boolean).join(" · ");
            return (
              <div
                key={l.uid}
                className="rounded-xl border border-white/5 bg-white/[0.04] p-2"
              >
                <div className="flex items-center gap-2">
                  {l.image && (
                    <img
                      src={l.image}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">{l.name}</div>
                    <div className="truncate text-[11px] text-white/50">
                      {meta || "—"} · {BRL(l.unitPrice)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-0.5">
                    <button
                      onClick={() => p.changeQty(l.uid, -1)}
                      className="grid h-6 w-6 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-white">{l.quantity}</span>
                    <button
                      onClick={() => p.changeQty(l.uid, 1)}
                      className="grid h-6 w-6 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {(l.extras.length > 0 || l.removed.length > 0 || l.note) && (
                  <div className="mt-1.5 space-y-0.5 pl-12 text-[10px] leading-tight">
                    {l.extras.map((e, i) => (
                      <div key={`e-${i}`} className="text-emerald-300/80">+ {e.label}</div>
                    ))}
                    {l.removed.map((r, i) => (
                      <div key={`r-${i}`} className="text-rose-300/80">− sem {r}</div>
                    ))}
                    {l.note && <div className="text-amber-300/80">obs: {l.note}</div>}
                  </div>
                )}

                <div className="mt-1.5 flex items-center justify-end gap-1 pl-12">
                  <button
                    onClick={() => p.onEditLine(l)}
                    className="grid h-6 w-6 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => p.removeLine(l.uid)}
                    className="grid h-6 w-6 place-items-center rounded-full text-red-300 hover:bg-red-500/10"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Customer */}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <FieldRow icon={UserRound} placeholder="Nome do cliente (opcional)" value={p.customerName} onChange={p.setCustomerName} />
        <FieldRow icon={Phone} placeholder="Telefone (opcional)" value={p.customerPhone} onChange={p.setCustomerPhone} />
        {p.mode === "entrega" && (
          <>
            <FieldRow icon={MapPin} placeholder="Endereço da entrega" value={p.address} onChange={p.setAddress} />
            <FieldRow icon={Truck} placeholder="Taxa de entrega (R$)" value={p.deliveryFee} onChange={p.setDeliveryFee} type="number" />
          </>
        )}
      </div>

      {/* Discount */}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">Desconto</div>
        <div className="flex gap-2">
          <div className="flex overflow-hidden rounded-lg border border-white/10">
            {(["reais", "percent"] as const).map((t) => (
              <button
                key={t}
                onClick={() => p.setDiscountType(t)}
                className={cn(
                  "px-3 py-2 text-xs font-bold",
                  p.discountType === t ? "bg-neon-pink/20 text-white" : "text-white/50 hover:text-white",
                )}
              >
                {t === "reais" ? "R$" : "%"}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={0}
            value={p.discountValue}
            onChange={(e) => p.setDiscountValue(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink/60"
          />
        </div>
      </div>

      {/* Payment */}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">Pagamento</div>
        <div className="grid grid-cols-4 gap-1.5">
          {PAYMENTS.map(({ id, label, icon: Icon }) => {
            const active = p.payment === id;
            return (
              <button
                key={id}
                onClick={() => p.setPayment(id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-bold uppercase tracking-wider transition",
                  active
                    ? "border-neon-yellow bg-neon-yellow/15 text-neon-yellow"
                    : "border-white/10 bg-white/5 text-white/60 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
        {p.payment === "dinheiro" && (
          <div className="space-y-1">
            <FieldRow icon={Banknote} placeholder="Valor recebido (R$)" value={p.cashReceived} onChange={p.setCashReceived} type="number" />
            {p.cashReceived && (
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold",
                  p.missing > 0
                    ? "bg-red-500/15 text-red-300"
                    : "bg-emerald-500/15 text-emerald-300",
                )}
              >
                <span>{p.missing > 0 ? "Falta" : "Troco"}</span>
                <span>{BRL(p.missing > 0 ? p.missing : p.change)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Note */}
      <div className="border-t border-white/10 pt-3">
        <div className="relative">
          <StickyNote className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-white/40" />
          <textarea
            rows={2}
            value={p.note}
            onChange={(e) => p.setNote(e.target.value)}
            placeholder="Observação (opcional)"
            className="w-full resize-none rounded-lg border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-neon-pink/60"
          />
        </div>
      </div>

      {/* Totals */}
      <div className="mt-1 space-y-1 border-t border-white/10 pt-3 text-xs">
        <Row label="Subtotal" value={BRL(p.subtotal)} />
        {p.discount > 0 && (
          <Row label="Desconto" value={`- ${BRL(p.discount)}`} accent="text-emerald-300" />
        )}
        {p.fee > 0 && <Row label="Entrega" value={BRL(p.fee)} />}
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-base font-black">
          <span className="text-white">Total</span>
          <span className="text-neon-yellow">{BRL(p.total)}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={p.clearAll}
          disabled={p.cart.length === 0}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-white/70 hover:bg-white/10 disabled:opacity-40"
        >
          Limpar
        </button>
        <button
          onClick={p.finalize}
          disabled={p.sending || p.cart.length === 0}
          className="flex-[2] rounded-xl bg-gradient-to-r from-neon-pink to-fuchsia-500 py-3 text-sm font-black uppercase tracking-wider text-white shadow-[0_10px_30px_-10px_rgb(255_20_147/.7)] disabled:opacity-50"
        >
          {p.sending ? "Enviando…" : `Finalizar · ${BRL(p.total)}`}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50">{label}</span>
      <span className={cn("font-bold text-white", accent)}>{value}</span>
    </div>
  );
}

function FieldRow({
  icon: Icon,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-pink/60"
      />
    </div>
  );
}



/* ---------------- Receipt HTML ---------------- */

function buildReceiptHtml(o: {
  orderId: string;
  cart: CartLine[];
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
  payment: string;
  cashReceived: number;
  change: number;
  mode: "retirada" | "entrega";
  customerName: string;
  address: string;
}) {
  const items = o.cart
    .map((l) => {
      const modLines: string[] = [];
      l.extras.forEach((e) => modLines.push(`+ ${escapeHtml(e.label)}`));
      l.removed.forEach((r) => modLines.push(`- sem ${escapeHtml(r)}`));
      if (l.note) modLines.push(`obs: ${escapeHtml(l.note)}`);
      const mods = modLines.length
        ? `<div style="font-size:10px;color:#333;padding-left:8px">${modLines.join("<br/>")}</div>`
        : "";
      return `
    <tr>
      <td>${l.quantity}x ${escapeHtml(l.name)}${l.size ? ` (${escapeHtml(l.size)})` : ""}${l.flavor ? ` — ${escapeHtml(l.flavor)}` : ""}${mods}</td>
      <td style="text-align:right">${BRL(l.unitPrice * l.quantity)}</td>
    </tr>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Recibo</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
    h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
    .muted { color: #444; text-align: center; font-size: 10px; }
    hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; vertical-align: top; }
    .row { display: flex; justify-content: space-between; }
    .total { font-size: 14px; font-weight: bold; }
  </style></head><body>
    <h1>QUERO BIS</h1>
    <div class="muted">Recibo não fiscal</div>
    <div class="muted">Pedido #${o.orderId.slice(0, 8).toUpperCase()}</div>
    <div class="muted">${new Date().toLocaleString("pt-BR")}</div>
    <hr/>
    <div>Cliente: ${escapeHtml(o.customerName)}</div>
    <div>Modo: ${o.mode === "entrega" ? "Entrega" : "Balcão"}</div>
    ${o.address ? `<div>Endereço: ${escapeHtml(o.address)}</div>` : ""}
    <hr/>
    <table>${items}</table>
    <hr/>
    <div class="row"><span>Subtotal</span><span>${BRL(o.subtotal)}</span></div>
    ${o.discount > 0 ? `<div class="row"><span>Desconto</span><span>- ${BRL(o.discount)}</span></div>` : ""}
    ${o.fee > 0 ? `<div class="row"><span>Entrega</span><span>${BRL(o.fee)}</span></div>` : ""}
    <div class="row total"><span>TOTAL</span><span>${BRL(o.total)}</span></div>
    <hr/>
    <div>Pagamento: ${escapeHtml(o.payment)}</div>
    ${o.cashReceived > 0 ? `<div class="row"><span>Recebido</span><span>${BRL(o.cashReceived)}</span></div>` : ""}
    ${o.change > 0 ? `<div class="row"><span>Troco</span><span>${BRL(o.change)}</span></div>` : ""}
    <hr/>
    <div class="muted">Obrigado pela preferência! ❤</div>
  </body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}
