import { Plus, Flame, Pencil, Pause } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { Product } from "@/data/menu";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { productImageSources } from "@/lib/image-optimize";
import { FavoriteButton } from "./FavoriteButton";
import { useIsAdmin, isProductPaused, isIndefinitePause } from "@/lib/menu-data";
import { useProductBadges, badgeInkFor } from "@/lib/product-badges";



/**
 * Badges usam tokens dinâmicos da tabela `product_badges` (cor + ícone).
 * Fallback de cor para nomes legados garante compatibilidade retroativa.
 */
const LEGACY_BADGE_COLORS: Record<string, string> = {
  Premium: "oklch(0.87 0.19 95)",
  Novidade: "oklch(0.80 0.16 200)",
  Favorito: "oklch(0.72 0.22 350)",
};


export function ProductCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (p: Product) => void;
}) {
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const stock = product.stock;
  const outOfStock = typeof stock === "number" && stock <= 0;
  const lowThreshold = product.lowStockThreshold ?? 5;
  const lowStock = typeof stock === "number" && stock > 0 && stock <= lowThreshold;
  const paused = isProductPaused(product);
  const pausedLabel = (() => {
    if (!paused || !product.pausedUntil) return null;
    if (isIndefinitePause(product.pausedUntil)) return "Voltamos em breve";
    const d = new Date(product.pausedUntil);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const hhmm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return `Volta hoje às ${hhmm}`;
    if (isTomorrow) return `Volta amanhã às ${hhmm}`;
    return `Volta ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  })();
  const blocked = outOfStock || paused;

  const statusLabel = (() => {
    if (paused) {
      const parts = ["produto pausado"];
      if (product.pauseReason) parts.push(product.pauseReason);
      if (pausedLabel) parts.push(pausedLabel.toLowerCase());
      else parts.push("indisponível no momento");
      return parts.join(", ");
    }
    if (outOfStock) return "esgotado, indisponível para pedido";
    if (lowStock) return `estoque baixo, restam ${stock}`;
    return "disponível";
  })();

  const ariaLabel = `${product.name}. ${statusLabel}. A partir de ${brl(product.basePrice)}.${
    blocked ? "" : " Toque para personalizar e adicionar ao carrinho."
  }`;

  return (

    <div
      onClick={(e) => {
        if (blocked) return;
        // Se o clique já veio de um controle interativo, deixa ele agir sozinho.
        const target = e.target as HTMLElement;
        if (target.closest("button, a, [role='button']")) return;
        onOpen(product);
      }}
      aria-disabled={blocked || undefined}
      data-status={paused ? "paused" : outOfStock ? "out-of-stock" : lowStock ? "low-stock" : "available"}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-visible rounded-2xl text-left select-none",
        blocked ? "cursor-not-allowed" : "cursor-pointer",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "transition-transform duration-150 ease-out will-change-transform",
        !blocked && "active:scale-[.97] active:duration-75 [@media(hover:hover)]:hover:-translate-y-0.5",
      )}
      style={{
        background:
          "linear-gradient(180deg, oklch(0.22 0.15 305) 0%, oklch(0.12 0.08 300) 100%)",
        boxShadow:
          "0 20px 38px -18px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >


      {/* Media do card — aspect 1:1 (token de tile). Cards de hero (NewsCarousel) usam 3:4 propositalmente. */}
      <div className="relative aspect-square w-full overflow-hidden rounded-t-[22px]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 30% 20%, oklch(0.42 0.24 340) 0%, oklch(0.26 0.18 315) 45%, oklch(0.14 0.09 300) 100%)",
          }}
        />
        {/* Static soft glows (lighter blur for mobile perf) */}
        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-neon-cyan/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-neon-pink/15 blur-2xl" />

        {/* Image — subtle continuous float (GPU-only transform, safe for scroll) */}
        <div
          className={cn(
            "absolute inset-0 will-change-transform animate-product-float",
            "transition-transform duration-300 ease-out",
            "[@media(hover:hover)]:group-hover:rotate-2 [@media(hover:hover)]:group-hover:scale-[1.05]",
            "group-active:scale-[.98] group-active:duration-100",
          )}
        >
          {(() => {
            const sources = productImageSources(product.image, { width: 400, quality: 78 });
            const imgEl = (
              <img
                src={product.image}
                alt=""
                aria-hidden="true"

                loading="lazy"
                decoding="async"
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain p-3 drop-shadow-[0_14px_18px_rgba(0,0,0,0.55)]"
                style={{
                  transform: `translate3d(${product.imagePosX ?? 0}%, ${product.imagePosY ?? 0}%, 0) scale(${product.imageScale ?? 1.75})`,
                  transformOrigin: "center",
                }}
              />
            );
            return sources ? (
              <picture>
                <source type="image/avif" srcSet={sources.avif} />
                <source type="image/webp" srcSet={sources.webp} />
                {imgEl}
              </picture>
            ) : (
              imgEl
            );
          })()}
        </div>




        {/* Badge sticker tilted */}
        {product.badge && (
          <div
            className={cn(
              "absolute left-2 top-2 z-20 flex -rotate-6 items-center gap-1 rounded-md px-2 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] shadow-lg",
              badgeStyles[product.badge],
            )}
            style={{
              boxShadow:
                "0 6px 12px -3px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            <Flame className="h-[10px] w-[10px] fill-current" strokeWidth={2.5} />
            {product.badge}
          </div>
        )}
        {/* Low stock / Out of stock overlay */}
        {lowStock && (
          <div className="absolute bottom-3 left-2 z-20 rounded-full bg-neon-pink px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-lg">
            Últimas {stock}!
          </div>
        )}
        {outOfStock && !paused && (
          <div aria-hidden="true" className="absolute inset-0 z-30 grid place-items-center rounded-t-[22px] bg-black/70 backdrop-blur-sm">
            <span className="rounded-full border border-white/30 bg-black/60 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white">
              Esgotado
            </span>
          </div>
        )}
        {paused && (
          <div aria-hidden="true" className="absolute inset-0 z-30 grid place-items-center rounded-t-[22px] bg-black/72 backdrop-blur-sm">
            <div className="flex max-w-[85%] flex-col items-center gap-1.5 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-100">
                <Pause className="h-3 w-3" strokeWidth={3} />
                Pausado
              </span>
              {product.pauseReason && (
                <span className="line-clamp-2 rounded-md bg-black/50 px-2 py-0.5 text-[10.5px] font-semibold leading-tight text-white/90">
                  {product.pauseReason}
                </span>
              )}
              {pausedLabel && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
                  {pausedLabel}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Favorite heart top-right */}
        <div className="absolute right-2 top-2 z-20">
          <FavoriteButton productId={product.id} />
        </div>

        {/* Admin edit button top-left (opposite the heart) */}
        {isAdmin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate({ to: "/admin", search: { edit: product.id } });
            }}
            aria-label="Editar produto no painel"
            className="absolute left-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-full border border-neon-cyan/40 bg-black/50 text-neon-cyan backdrop-blur transition hover:bg-neon-cyan hover:text-black active:scale-95"
          >
            <Pencil className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}



        {/* Wavy divider on bottom */}
        <svg
          className="absolute -bottom-px left-0 h-4 w-full"
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 6 Q 12.5 0, 25 6 T 50 6 T 75 6 T 100 6 V 12 H 0 Z"
            fill="oklch(0.16 0.11 305)"
          />
        </svg>
      </div>

      {/* Content — abaixo do "papel" ondulado */}
      <div className="relative flex flex-1 flex-col px-3 pb-3 pt-3">
        <h3
          className="pr-1 text-[13.5px] font-black uppercase leading-tight text-white"
          style={{
            fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
            letterSpacing: "0.03em",
          }}
        >
          {product.name}
        </h3>

        {/* Ingredients — full list, wrapped */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
          {product.ingredients.map((c, i) => (
            <span
              key={c}
              className="text-[9.5px] font-medium leading-snug text-white/70"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {c}
              {i < product.ingredients.length - 1 && (
                <span className="mx-1 text-neon-pink">•</span>
              )}
            </span>
          ))}
        </div>

        {/* Price + compact add button */}
        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="flex flex-col leading-none">
            <span
              className="text-[9px] font-bold uppercase tracking-[0.28em] text-white/60"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              A partir de
            </span>
            <span
              className="mt-1 text-[22px] font-black text-neon-yellow drop-shadow-[0_2px_8px_rgba(255,215,60,0.35)]"
              style={{
                fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
                letterSpacing: "0.01em",
                lineHeight: 1,
              }}
            >
              {brl(product.basePrice)}
            </span>
          </div>

          <button
            type="button"
            disabled={blocked}
            aria-label={ariaLabel}
            onClick={(e) => {
              e.stopPropagation();
              if (!blocked) onOpen(product);
            }}
            className={cn(
              "hit-target grid h-10 w-10 shrink-0 place-items-center rounded-full",
              "transition-transform duration-150 ease-out will-change-transform",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.14_0.09_300)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
              !blocked && "active:scale-90 [@media(hover:hover)]:hover:scale-105",
            )}
            style={{
              background:
                "linear-gradient(180deg, oklch(0.78 0.26 350) 0%, oklch(0.60 0.28 350) 100%)",
              boxShadow:
                "0 8px 18px -6px oklch(0.60 0.28 350 / 0.75), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            <Plus className="h-5 w-5 text-white" strokeWidth={3.4} aria-hidden="true" />
          </button>

        </div>

      </div>
    </div>
  );
}
