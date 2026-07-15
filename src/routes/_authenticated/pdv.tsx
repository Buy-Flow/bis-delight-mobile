import { useMemo, useState, useEffect, useRef } from "react";
import { confirmDialog } from "@/lib/confirm";
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
  Copy,
  PauseCircle,
  PlayCircle,
  TrendingUp,
  Keyboard,
  ChefHat,
  Receipt,
} from "lucide-react";
import { useProducts, useCategories } from "@/lib/menu-data";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/data/menu";
import { formatSP } from "@/lib/tz";
import type { CartItem } from "@/lib/cart-context";
import { ProductModal } from "@/components/menu/ProductModal";
import { cn } from "@/lib/utils";
import { shortUid } from "@/lib/uid";

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

/* ---------------- Parked sales (comandas suspensas) ---------------- */

type ParkedSale = {
  id: string;
  savedAt: string;
  label: string;
  cart: CartLine[];
  mode: "retirada" | "entrega";
  customerName: string;
  customerPhone: string;
  address: string;
  deliveryFee: string;
  discountType: "reais" | "percent";
  discountValue: string;
  payment: PaymentMethod;
  note: string;
};

const PARKED_KEY = "pdv:parked-sales:v1";

function loadParkedSales(): ParkedSale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PARKED_KEY);
    return raw ? (JSON.parse(raw) as ParkedSale[]) : [];
  } catch {
    return [];
  }
}
function saveParkedSales(list: ParkedSale[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PARKED_KEY, JSON.stringify(list));
  } catch {
    // ignore quota
  }
}


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
  const [parked, setParked] = useState<ParkedSale[]>(() => loadParkedSales());
  const [showParked, setShowParked] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const customerBoxRef = useRef<HTMLDivElement>(null);

  // Persist parked sales
  useEffect(() => {
    saveParkedSales(parked);
  }, [parked]);

  // Cycle payment methods
  const cyclePayment = () => {
    const idx = PAYMENTS.findIndex((p) => p.id === payment);
    setPayment(PAYMENTS[(idx + 1) % PAYMENTS.length].id);
  };

  const duplicateLast = () => {
    setCart((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      return [...prev, { ...last, uid: shortUid(10) }];
    });
    toast.success("Item duplicado");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const editing =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      // Global (work even inside inputs)
      if (e.key === "Escape") {
        if (showParked) setShowParked(false);
        else if (showShortcuts) setShowShortcuts(false);
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        cyclePayment();
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          '[data-pdv-customer] input',
        );
        input?.focus();
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        finalize();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateLast();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        parkCurrentSale();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        setShowParked(true);
        return;
      }
      if (!editing && e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (!editing && e.key === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, payment, showParked, showShortcuts]);

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

  // Park current sale to localStorage (comanda suspensa)
  const parkCurrentSale = () => {
    if (cart.length === 0) {
      toast.error("Nada para suspender.");
      return;
    }
    const entry: ParkedSale = {
      id: shortUid(6),
      savedAt: new Date().toISOString(),
      label: (customerName.trim() || `Comanda ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`),
      cart,
      mode,
      customerName,
      customerPhone,
      address,
      deliveryFee,
      discountType,
      discountValue,
      payment,
      note,
    };
    setParked((prev) => [entry, ...prev].slice(0, 20));
    resetSale();
    toast.success("Venda suspensa. Ctrl+R para retomar.");
  };

  const resumeSale = (p: ParkedSale) => {
    if (cart.length > 0) {
      toast.error("Finalize ou suspenda a venda atual primeiro.");
      return;
    }
    setCart(p.cart);
    setMode(p.mode);
    setCustomerName(p.customerName);
    setCustomerPhone(p.customerPhone);
    setAddress(p.address);
    setDeliveryFee(p.deliveryFee);
    setDiscountType(p.discountType);
    setDiscountValue(p.discountValue);
    setPayment(p.payment);
    setNote(p.note);
    setParked((prev) => prev.filter((x) => x.id !== p.id));
    setShowParked(false);
    toast.success(`Retomado: ${p.label}`);
  };

  const deleteParked = async (id: string) => {
    if (!(await confirmDialog({ message: "Descartar esta comanda suspensa?" }))) return;
    setParked((prev) => prev.filter((x) => x.id !== id));
  };


  const addFromModal = (payload: Omit<CartItem, "uid">, isEdit: boolean) => {
    if (isEdit && editingLine) {
      setCart((prev) =>
        prev.map((l) => (l.uid === editingLine.uid ? { ...payload, uid: editingLine.uid } : l)),
      );
    } else {
      const uid = shortUid(10);
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

  const clearAll = async () => {
    if (cart.length === 0) return;
    if (!(await confirmDialog({ message: "Limpar toda a venda atual?" }))) return;
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

  const printReceipt = (variant: "cliente" | "cozinha" | "ambos" = "cliente") => {
    const base = {
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
    };
    const doPrint = (html: string) => {
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
    if (variant === "cliente") doPrint(buildReceiptHtml(base));
    else if (variant === "cozinha") doPrint(buildKitchenHtml(base));
    else {
      doPrint(buildReceiptHtml(base));
      setTimeout(() => doPrint(buildKitchenHtml(base)), 400);
    }
  };


  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Shift summary bar */}
      <ShiftSummaryBar userId={user?.id} />

      <div className="mx-auto grid max-w-[1600px] items-start gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Catalog */}
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto ou código…  (F2 ou /)"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-pink/60"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-neon-yellow" />
              {filteredProducts.length} itens
            </div>
            <button
              onClick={() => setShowParked(true)}
              className="relative flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20"
              title="Comandas suspensas (Ctrl+R)"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Suspensas
              {parked.length > 0 && (
                <span className="ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-black">
                  {parked.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10 md:flex"
              title="Atalhos de teclado (?)"
            >
              <Keyboard className="h-3.5 w-3.5" /> Atalhos
            </button>
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
                <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-black/60 to-black/20 p-2">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.4)] transition group-hover:scale-105"
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
        <aside className="hidden self-start lg:sticky lg:top-20 lg:block">
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
          <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-card p-4">
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
          compact
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
            <div className="mt-5 grid grid-cols-3 gap-2">
              <button
                onClick={() => printReceipt("cliente")}
                className="flex items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-bold text-white hover:bg-white/10"
              >
                <Receipt className="h-4 w-4" /> Cliente
              </button>
              <button
                onClick={() => printReceipt("cozinha")}
                className="flex items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-bold text-white hover:bg-white/10"
              >
                <ChefHat className="h-4 w-4" /> Cozinha
              </button>
              <button
                onClick={() => printReceipt("ambos")}
                className="flex items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-bold text-white hover:bg-white/10"
              >
                <Printer className="h-4 w-4" /> Ambos
              </button>
            </div>
            <button
              onClick={resetSale}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-pink to-fuchsia-500 py-3 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" /> Nova venda
            </button>
          </div>
        </div>
      )}

      {/* Parked sales drawer */}
      {showParked && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setShowParked(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-amber-400/30 bg-[oklch(0.13_0.05_300)] p-5 shadow-[0_20px_60px_-20px_rgb(251_191_36/.5)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PauseCircle className="h-5 w-5 text-amber-300" />
                <div className="text-lg font-black text-white">Comandas suspensas</div>
              </div>
              <button onClick={() => setShowParked(false)} className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            {parked.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-8 text-center text-sm text-white/50">
                Nenhuma comanda suspensa.
                <div className="mt-1 text-[11px] text-white/40">Ctrl+S para suspender a venda atual.</div>
              </div>
            ) : (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {parked.map((p) => {
                  const sub = p.cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
                  const qty = p.cart.reduce((s, l) => s + l.quantity, 0);
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-300">
                        <PauseCircle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-white">{p.label}</div>
                        <div className="truncate text-[11px] text-white/50">
                          {qty} itens · {BRL(sub)} · {new Date(p.savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <button
                        onClick={() => resumeSale(p)}
                        className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Retomar
                      </button>
                      <button
                        onClick={() => deleteParked(p.id)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shortcuts help */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setShowShortcuts(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[oklch(0.13_0.05_300)] p-5"
          >
            <div className="mb-3 flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-neon-yellow" />
              <div className="text-lg font-black text-white">Atalhos de teclado</div>
            </div>
            <div className="space-y-1.5 text-sm">
              {[
                ["F2", "Focar busca de produto"],
                ["F4", "Alternar forma de pagamento"],
                ["F8", "Focar busca de cliente"],
                ["F9", "Finalizar venda"],
                ["Ctrl+D", "Duplicar último item"],
                ["Ctrl+S", "Suspender venda atual"],
                ["Ctrl+R", "Ver comandas suspensas"],
                ["/", "Foco na busca"],
                ["Esc", "Fechar diálogos"],
                ["?", "Este menu"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
                  <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] font-bold text-neon-yellow">{k}</kbd>
                  <span className="text-white/80">{v}</span>
                </div>
              ))}
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
        <CustomerSearch
          name={p.customerName}
          phone={p.customerPhone}
          onPick={(n, ph) => {
            p.setCustomerName(n);
            p.setCustomerPhone(ph);
          }}
          onNameChange={p.setCustomerName}
          onPhoneChange={p.setCustomerPhone}
        />
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
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-white/10">
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
            className="w-full min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink/60"
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

/* ---------------- Customer Search ---------------- */

type CustomerSuggestion = {
  name: string;
  phone: string;
  source: "cliente" | "recente";
};

function CustomerSearch({
  name,
  phone,
  onPick,
  onNameChange,
  onPhoneChange,
}: {
  name: string;
  phone: string;
  onPick: (name: string, phone: string) => void;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(!!name || !!phone);
  const wrapRef = useRef<HTMLDivElement>(null);

  // sync locked view when parent state resets
  useEffect(() => {
    if (!name && !phone) setLocked(false);
  }, [name, phone]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const isDigits = /^\d+$/.test(q.replace(/\D+/g, "")) && q.replace(/\D+/g, "").length >= 3;
      const digits = q.replace(/\D+/g, "");
      const orFilter = isDigits
        ? `phone.ilike.%${digits}%,full_name.ilike.%${q}%`
        : `full_name.ilike.%${q}%,phone.ilike.%${q}%`;
      const [profRes, ordRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone")
          .or(orFilter)
          .limit(8),
        supabase
          .from("orders")
          .select("customer_name, phone")
          .or(
            isDigits
              ? `phone.ilike.%${digits}%,customer_name.ilike.%${q}%`
              : `customer_name.ilike.%${q}%,phone.ilike.%${q}%`,
          )
          .order("created_at", { ascending: false })
          .limit(12),
      ]);
      if (cancelled) return;
      const seen = new Set<string>();
      const list: CustomerSuggestion[] = [];
      (profRes.data ?? []).forEach((p) => {
        const n = (p.full_name ?? "").trim();
        const ph = (p.phone ?? "").trim();
        if (!n && !ph) return;
        const key = `${n}|${ph}`.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        list.push({ name: n, phone: ph, source: "cliente" });
      });
      (ordRes.data ?? []).forEach((o) => {
        const n = (o.customer_name ?? "").trim();
        const ph = (o.phone ?? "").trim();
        if (!n || n === "Balcão") return;
        const key = `${n}|${ph}`.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        list.push({ name: n, phone: ph === "-" ? "" : ph, source: "recente" });
      });
      setResults(list.slice(0, 8));
      setLoading(false);
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  if (locked) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-neon-pink/30 bg-neon-pink/5 px-3 py-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neon-pink/20 text-neon-pink">
          <UserRound className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-white">{name || "Sem nome"}</div>
          <div className="truncate text-[11px] text-white/60">{phone || "sem telefone"}</div>
        </div>
        <button
          onClick={() => {
            setLocked(false);
            setQuery("");
            setOpen(true);
          }}
          className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          title="Trocar cliente"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const showAdd =
    query.trim().length >= 2 &&
    !loading &&
    !results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onNameChange(e.target.value);
          }}
          placeholder="Buscar cliente por nome ou telefone…"
          className="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-pink/60"
        />
      </div>

      {open && (query.trim().length >= 2 || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-[oklch(0.14_0.07_300)] p-1 shadow-[0_20px_50px_-10px_rgba(0,0,0,.6)]">
          {loading && (
            <div className="px-3 py-2 text-xs text-white/50">Buscando…</div>
          )}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-3 py-2 text-xs text-white/50">Nenhum cliente encontrado.</div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.name}-${r.phone}-${i}`}
              onClick={() => {
                onPick(r.name, r.phone);
                setLocked(true);
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/5"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-white">
                {(r.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{r.name || "—"}</div>
                <div className="truncate text-[11px] text-white/50">{r.phone || "sem telefone"}</div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                  r.source === "cliente"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-amber-500/15 text-amber-300",
                )}
              >
                {r.source}
              </span>
            </button>
          ))}
          {showAdd && (
            <button
              onClick={() => {
                setLocked(true);
                setOpen(false);
                onNameChange(query.trim());
                setQuery("");
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-neon-pink/40 bg-neon-pink/5 px-2 py-2 text-left hover:bg-neon-pink/10"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neon-pink/20 text-neon-pink">
                <Plus className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">
                  Cadastrar “{query.trim()}”
                </div>
                <div className="text-[11px] text-white/50">Novo cliente nesta venda</div>
              </div>
            </button>
          )}
          {!showAdd && query.trim().length < 2 && (
            <div className="px-3 py-2 text-[11px] text-white/40">
              Digite ao menos 2 caracteres.
            </div>
          )}
        </div>
      )}

      {/* Optional phone field when adding a new customer inline */}
      {!locked && query.trim().length >= 2 && (
        <div className="mt-2">
          <FieldRow
            icon={Phone}
            placeholder="Telefone (opcional)"
            value={phone}
            onChange={onPhoneChange}
            type="tel"
          />
        </div>
      )}
    </div>
  );
}



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
    <div class="muted">${formatSP(new Date())}</div>
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

/* ---------------- Kitchen ticket (grande, sem preços) ---------------- */

function buildKitchenHtml(o: {
  orderId: string;
  cart: CartLine[];
  mode: "retirada" | "entrega";
  customerName: string;
  address: string;
} & Record<string, unknown>) {
  const items = o.cart
    .map((l) => {
      const modLines: string[] = [];
      l.extras.forEach((e) => modLines.push(`+ ${escapeHtml(e.label)}`));
      l.removed.forEach((r) => modLines.push(`SEM ${escapeHtml(r).toUpperCase()}`));
      if (l.note) modLines.push(`OBS: ${escapeHtml(l.note)}`);
      const mods = modLines.length
        ? `<div style="font-size:14px;padding-left:10px;margin-top:2px">${modLines.join("<br/>")}</div>`
        : "";
      return `<div style="border-bottom:1px dashed #000;padding:6px 0"><div style="font-size:18px;font-weight:bold">${l.quantity}x ${escapeHtml(l.name)}${l.size ? ` (${escapeHtml(l.size)})` : ""}${l.flavor ? ` — ${escapeHtml(l.flavor)}` : ""}</div>${mods}</div>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Cozinha</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: 'Courier New', monospace; color: #000; font-size: 13px; }
    h1 { font-size: 20px; text-align: center; margin: 0 0 6px; text-transform: uppercase; }
    .muted { text-align: center; font-size: 11px; margin-bottom: 4px; }
    .badge { border: 2px solid #000; padding: 4px 8px; text-align: center; font-weight: bold; font-size: 16px; margin: 6px 0; }
  </style></head><body>
    <h1>◆ COZINHA ◆</h1>
    <div class="muted">Pedido #${o.orderId.slice(0, 8).toUpperCase()} · ${formatSP(new Date())}</div>
    <div class="badge">${o.mode === "entrega" ? "ENTREGA" : "BALCÃO"} · ${escapeHtml(o.customerName)}</div>
    ${o.address ? `<div style="font-size:12px;margin-bottom:6px">Endereço: ${escapeHtml(o.address)}</div>` : ""}
    ${items}
  </body></html>`;
}

/* ---------------- Shift Summary ---------------- */

type ShiftMethodTotals = { count: number; total: number };

function ShiftSummaryBar({ userId }: { userId?: string }) {
  const [stats, setStats] = useState<{
    count: number;
    total: number;
    byMethod: Record<string, ShiftMethodTotals>;
  } | null>(null);
  const [open, setOpen] = useState(false);

  const load = useMemo(
    () => async () => {
      if (!userId) return;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("orders")
        .select("total, note, status, created_at")
        .eq("user_id", userId)
        .gte("created_at", start.toISOString())
        .in("status", ["pago", "entregue", "concluido"]);
      const rows = data ?? [];
      const byMethod: Record<string, ShiftMethodTotals> = {};
      let total = 0;
      for (const r of rows) {
        const t = Number(r.total) || 0;
        total += t;
        const noteStr = String(r.note ?? "");
        const m = noteStr.match(/PDV · (Dinheiro|PIX|Débito|Crédito)/i);
        const key = m ? m[1] : "Outros";
        if (!byMethod[key]) byMethod[key] = { count: 0, total: 0 };
        byMethod[key].count++;
        byMethod[key].total += t;
      }
      setStats({ count: rows.length, total, byMethod });
    },
    [userId],
  );

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (!stats) return null;
  const avg = stats.count > 0 ? stats.total / stats.count : 0;

  return (
    <div className="border-b border-white/5 bg-gradient-to-r from-fuchsia-900/20 via-transparent to-emerald-900/20 px-4 py-2.5 md:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 font-bold text-emerald-200">
          <TrendingUp className="h-3.5 w-3.5" />
          Turno hoje
        </div>
        <ShiftStat label="Vendas" value={String(stats.count)} />
        <ShiftStat label="Faturamento" value={BRL(stats.total)} accent />
        <ShiftStat label="Ticket médio" value={BRL(avg)} />
        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-auto flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70 hover:bg-white/10"
        >
          {open ? "Ocultar detalhes" : "Ver por método"}
        </button>
      </div>
      {open && (
        <div className="mx-auto mt-2 grid max-w-[1600px] gap-2 sm:grid-cols-2 md:grid-cols-4">
          {(["Dinheiro", "PIX", "Débito", "Crédito"] as const).map((k) => {
            const s = stats.byMethod[k] ?? { count: 0, total: 0 };
            return (
              <div key={k} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/50">{k}</div>
                  <div className="text-sm font-black text-white">{BRL(s.total)}</div>
                </div>
                <div className="text-[11px] font-bold text-white/60">{s.count}x</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShiftStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-white/40">{label}</span>
      <span className={cn("font-black", accent ? "text-neon-yellow" : "text-white")}>{value}</span>
    </div>
  );
}

