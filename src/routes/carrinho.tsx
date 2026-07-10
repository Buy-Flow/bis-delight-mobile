import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Plus, Minus, Trash2, ShoppingBag, Pencil, Truck, Sparkles } from "lucide-react";
import { brl, useCart } from "@/lib/cart-context";
import { BRAND } from "@/data/menu";
import { useProducts } from "@/lib/menu-data";
import { usePersonalizedSuggestions } from "@/lib/use-personalized-suggestions";

const ProductModal = lazy(() =>
  import("@/components/menu/ProductModal").then((m) => ({ default: m.ProductModal })),
);
const CheckoutSheet = lazy(() =>
  import("@/components/menu/CheckoutSheet").then((m) => ({ default: m.CheckoutSheet })),
);

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Seu carrinho — Quero Bis" },
      { name: "description", content: "Revise seu pedido e finalize com a gente." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const navigate = useNavigate();
  const {
    items,
    update,
    remove,
    subtotal,
    openCheckout,
    openEdit,
    isCheckoutOpen,
    editingItem,
    closeEdit,
    requestOpenProduct,
  } = useCart();
  const { data: allProducts = [] } = useProducts();

  const suggestions = useMemo(() => {
    if (!items.length) return [];
    const inCart = new Set(items.map((i) => i.productId));
    return allProducts
      .filter((p) => !inCart.has(p.id) && !p.isCustom && p.basePrice > 0)
      .sort((a, b) => a.basePrice - b.basePrice)
      .slice(0, 6);
  }, [allProducts, items]);

  const editingProduct = editingItem
    ? allProducts.find((x) => x.id === editingItem.productId)
    : null;

  const fee = items.length ? BRAND.deliveryFee : 0;
  const total = subtotal + fee;




  const handleSuggestion = (id: string) => {
    requestOpenProduct(id);
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-dvh bg-[oklch(0.14_0.09_305)] text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-b from-[oklch(0.14_0.09_305)] via-[oklch(0.14_0.09_305)]/85 to-transparent pb-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 pr-4">



          <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-neon-pink/25 to-neon-purple/25 ring-1 ring-white/15">
            <ShoppingBag className="h-5 w-5 text-neon-yellow" />
            {items.length > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-neon-pink px-1 text-[10px] font-black text-white ring-2 ring-[oklch(0.14_0.09_305)]">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-yellow shadow-[0_0_8px_theme(colors.neon-yellow)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-yellow/90">Pedido</span>
            </div>
            <h1 className="text-[20px] font-black leading-tight text-white">
              Seu <span className="bg-gradient-to-r from-neon-pink to-neon-yellow bg-clip-text text-transparent">carrinho</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-2xl px-4 pt-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white/5">
              <ShoppingBag className="h-7 w-7 text-neon-cyan" />
            </div>
            <div className="font-display text-xl text-white">Nada por aqui ainda</div>
            <p className="max-w-[240px] text-sm text-white/60">
              Escolha um dos nossos sabores e monte seu pedido.
            </p>
            <Link
              to="/"
              className="mt-2 rounded-full bg-neon-pink px-5 py-2 text-sm font-bold text-white glow-pink"
            >
              Ver cardápio
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div
                key={it.uid}
                role="button"
                tabIndex={0}
                onClick={() => openEdit(it)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEdit(it);
                  }
                }}
                className="relative flex cursor-pointer gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-3 transition active:scale-[0.99] hover:border-white/20"
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[oklch(0.24_0.14_305)]">
                  <img src={it.image} alt={it.name} className="absolute inset-0 h-full w-full object-contain p-1" loading="lazy" />
                </div>

                <div className="min-w-0 flex-1 pr-8">
                  <div className="truncate font-display text-lg font-extrabold leading-tight text-white">
                    {it.name}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[12px] text-white/60">
                    {[it.size, it.flavor, ...it.extras.map((e) => e.label)].filter(Boolean).join(", ") || "\u00a0"}
                  </div>
                  {it.removed.length > 0 && (
                    <div className="mt-0.5 truncate text-[11px] text-neon-pink/80">
                      sem {it.removed.join(", ")}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="font-display text-lg font-extrabold text-neon-pink">
                      {brl(it.unitPrice * it.quantity)}
                    </div>
                    <div
                      className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-1 py-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (it.quantity <= 1) {
                            remove(it.uid);
                          } else {
                            update(it.uid, { quantity: it.quantity - 1 });
                          }
                        }}
                        className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white active:scale-95"
                        aria-label="Diminuir"
                      >
                        {it.quantity <= 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      </button>
                      <div className="w-5 text-center text-sm font-extrabold text-white">{it.quantity}</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          update(it.uid, { quantity: it.quantity + 1 });
                        }}
                        className="grid h-7 w-7 place-items-center rounded-full bg-neon-pink text-white glow-pink active:scale-95"
                        aria-label="Aumentar"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(it);
                  }}
                  className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 active:scale-95"
                  aria-label="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {suggestions.length > 0 && (
              <div className="mt-4 rounded-3xl border border-neon-cyan/25 bg-gradient-to-br from-neon-cyan/[0.06] to-neon-pink/[0.04] p-3">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-neon-cyan/20 text-neon-cyan">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-neon-cyan">
                    Que tal levar também?
                  </div>
                </div>
                <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSuggestion(p.id)}
                      className="group relative w-[132px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition active:scale-[0.97] hover:border-neon-pink/50"
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-[oklch(0.24_0.14_305)] p-2">
                        <img
                          src={p.image}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                        <span className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-neon-pink text-white glow-pink">
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <div className="p-2">
                        <div className="truncate text-[12px] font-extrabold leading-tight text-white">
                          {p.name}
                        </div>
                        <div className="mt-0.5 text-[12px] font-black text-neon-yellow">
                          {brl(p.basePrice)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Link
              to="/"
              className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-neon-pink/50 bg-neon-pink/5 px-4 py-3.5 text-sm font-extrabold text-white transition hover:border-neon-pink active:scale-[.99]"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-neon-pink text-white">
                <Plus className="h-4 w-4" />
              </span>
              Adicionar mais itens
            </Link>
          </div>
        )}
      </div>

      {/* Footer inline (rola com o conteúdo) */}
      {items.length > 0 && (
        <div className="mx-auto max-w-2xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-8">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-5">
            <div className="mb-4 space-y-2.5">
              <SummaryRow icon={ShoppingBag} label="Subtotal" value={brl(subtotal)} />
              <SummaryRow icon={Truck} label="Entrega" value={fee > 0 ? brl(fee) : "R$ 0,00"} />
              <div className="mt-2 flex items-end justify-between border-t border-white/10 pt-3">
                <span className="font-display text-2xl font-extrabold text-white">Total</span>
                <div className="text-right">
                  <div className="font-display text-3xl font-extrabold text-neon-yellow glow-yellow-text">
                    {brl(total)}
                  </div>
                  <div className="ml-auto mt-1 h-1 w-20 rounded-full bg-gradient-to-r from-transparent to-neon-pink" />
                </div>
              </div>
            </div>
            <button
              onClick={openCheckout}
              className="w-full rounded-2xl bg-neon-pink px-4 py-4 text-base font-extrabold text-white glow-pink active:scale-[.98]"
            >
              Continuar para finalização
            </button>
          </div>
        </div>
      )}

      {/* Overlays */}
      <Suspense fallback={null}>
        {editingItem && editingProduct && (
          <ProductModal
            key={`edit-${editingItem.uid}`}
            product={editingProduct}
            editItem={editingItem}
            onClose={closeEdit}
          />
        )}
        {isCheckoutOpen && <CheckoutSheet />}
      </Suspense>
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-neon-yellow">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-white/80">{label}</span>
      </div>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}
