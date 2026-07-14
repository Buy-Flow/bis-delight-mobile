import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { Plus, Minus, Trash2, ShoppingBag, Pencil, Truck, Sparkles, Gift, Share2, Copy, MessageCircle, X, Users } from "lucide-react";
import { brl, useCart } from "@/lib/cart-context";
import { BRAND } from "@/data/menu";
import { useProducts } from "@/lib/menu-data";
import { usePersonalizedSuggestions } from "@/lib/use-personalized-suggestions";
import { FreeDeliveryBar } from "@/components/menu/FreeDeliveryBar";
import { createSharedCart, shareUrlFor } from "@/lib/shared-cart";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { useComboDiscounts } from "@/lib/use-combo-discounts";

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
    openEdit,
    isCheckoutOpen,
    editingItem,
    closeEdit,
    requestOpenProduct,
    shareMode,
    setShareMode,
  } = useCart();
  const { data: allProducts = [] } = useProducts();

  const [shareOpen, setShareOpen] = useState(false);

  const suggestions = usePersonalizedSuggestions(items, allProducts);

  const editingProduct = editingItem
    ? allProducts.find((x) => x.id === editingItem.productId)
    : null;

  const combo = useComboDiscounts(items, allProducts);
  const fee = items.length ? BRAND.deliveryFee : 0;
  const total = subtotal + fee - combo.discount;




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

      {shareMode && (
        <div className="mx-auto max-w-2xl px-4">
          <div className="flex items-center gap-2 rounded-2xl border border-neon-cyan/30 bg-neon-cyan/10 p-3 text-xs">
            <Users className="h-4 w-4 text-neon-cyan shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-neon-cyan">Modo compartilhado</div>
              <div className="text-white/70 truncate">
                Você tá adicionando como <b>{shareMode.name}</b>
                {shareMode.ownerName ? ` no carrinho de ${shareMode.ownerName}` : ""}.
              </div>
            </div>
            <button
              onClick={() => navigate({ to: "/c/$token", params: { token: shareMode.token } })}
              className="rounded-full bg-neon-cyan/20 px-3 py-1 text-[11px] font-bold text-neon-cyan"
            >
              Ver
            </button>
            <button
              onClick={() => {
                setShareMode(null);
                toast.info("Você saiu do carrinho compartilhado");
              }}
              className="rounded-full bg-white/10 p-1.5 text-white/70"
              aria-label="Sair"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

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
            <FreeDeliveryBar />
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
                    Selecionado pra você
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
                        <div className="mb-0.5 line-clamp-1 text-[9px] font-black uppercase tracking-wider text-neon-cyan">
                          {p.reason}
                        </div>
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
              {combo.discount > 0 && combo.matches[0] && (
                <div className="flex items-center justify-between rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-neon-cyan/20 text-neon-cyan">
                      <Gift className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-black text-neon-cyan">
                        {combo.matches[0].combo.name}
                      </div>
                      <div className="text-[10px] text-white/60">
                        -{combo.matches[0].combo.discountPercent}% aplicado
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-black text-neon-cyan">-{brl(combo.discount)}</span>
                </div>
              )}
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
              onClick={() => navigate({ to: "/finalizar" })}
              className="w-full rounded-2xl bg-neon-pink px-4 py-4 text-base font-extrabold text-white glow-pink active:scale-[.98]"
            >
              Continuar para finalização
            </button>
            {!shareMode && (
              <button
                onClick={() => setShareOpen(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-3 text-sm font-extrabold text-neon-cyan active:scale-[.98]"
              >
                <Users className="h-4 w-4" />
                Compartilhar carrinho — dividir a conta
              </button>
            )}
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

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} items={items} />
    </div>
  );
}

function ShareDialog({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: import("@/lib/cart-context").CartItem[];
}) {
  const [ownerName, setOwnerName] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ url: string; token: string } | null>(null);

  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as { full_name?: string; name?: string } | undefined;
      const raw =
        meta?.full_name ||
        meta?.name ||
        data.user?.email?.split("@")[0] ||
        localStorage.getItem("querobis:share_name") ||
        "";
      if (raw) setOwnerName(raw.split(" ")[0]);
    });
    return undefined;
  });

  async function handleCreate() {
    if (ownerName.trim().length < 2) {
      toast.error("Digite seu nome");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione itens primeiro");
      return;
    }
    setCreating(true);
    try {
      const token = await createSharedCart({
        ownerName: ownerName.trim(),
        message,
        items,
      });
      const url = shareUrlFor(token);
      setResult({ url, token });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar link");
    } finally {
      setCreating(false);
    }
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result.url);
    toast.success("Link copiado!");
  }

  function whats() {
    if (!result) return;
    const msg = `Bora dividir esse pedido? Tô montando um carrinho no Quero Bis 🍨\n${result.url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setResult(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {result ? "Link pronto!" : "Compartilhar carrinho"}
          </DialogTitle>
        </DialogHeader>
        {!result ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Seu nome</label>
              <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={30} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Recado (opcional)
              </label>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex: bora fechar antes das 20h!"
                maxLength={120}
              />
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              A galera abre o link, entra com o nome deles e adiciona os próprios itens. O link vale
              por 24 horas.
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-60"
            >
              {creating ? "Gerando link…" : "Gerar link do carrinho"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm break-all">
              {result.url}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={copy}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 py-2.5 text-sm font-semibold"
              >
                <Copy className="h-4 w-4" /> Copiar
              </button>
              <button
                onClick={whats}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Você é o dono do carrinho. Só você pode finalizar o pedido.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
