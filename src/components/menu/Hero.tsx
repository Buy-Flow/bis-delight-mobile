import { ArrowRight, Sparkles } from "lucide-react";
import { BRAND, PRODUCTS } from "@/data/menu";
import { useCart } from "@/lib/cart-context";

export function Hero({ onScrollMenu }: { onScrollMenu: () => void }) {
  const hero1 = PRODUCTS.find((p) => p.id === "acai-turbinado")!;
  const hero2 = PRODUCTS.find((p) => p.id === "taca-rosa")!;
  const hero3 = PRODUCTS.find((p) => p.id === "milk-oreo")!;
  const { openCart } = useCart();

  const waLink = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(
    "Olá! Quero fazer um pedido na Quero Bis 🍧",
  )}`;

  return (
    <section className="relative overflow-hidden px-4 pb-8 pt-4">
      {/* Textured backdrop */}
      <div
        className="absolute inset-0 -z-10 opacity-40 mix-blend-overlay"
        style={{
          backgroundImage: `url(${BRAND.texture})`,
          backgroundSize: "cover",
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-neon-pink/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-20 h-64 w-64 rounded-full bg-neon-cyan/25 blur-3xl" />

      <div className="relative pt-2">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-widest text-neon-cyan">
          <Sparkles className="h-3 w-3" />
          Aberto agora · Delivery {BRAND.hours.split(" ")[0]}
        </div>

        <h1 className="font-display text-[42px] leading-[1] font-extrabold text-neon-yellow glow-yellow-text">
          Peça seu
          <br />
          sorvete
          <br />
          <span className="text-neon-pink">favorito.</span>
        </h1>
        <p className="mt-3 max-w-xs text-[15px] leading-snug text-white/80">
          A felicidade cabe em cada colher. Monte, personalize e receba em casa.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-neon-pink px-5 py-3 text-sm font-bold text-white glow-pink active:scale-[.98] transition"
          >
            Pedir agora no WhatsApp
            <ArrowRight className="h-4 w-4 transition -mr-1 group-active:translate-x-1" />
          </a>
          <button
            onClick={onScrollMenu}
            className="rounded-full border border-neon-cyan/60 px-5 py-3 text-sm font-semibold text-neon-cyan"
          >
            Ver cardápio
          </button>
        </div>

        {/* Floating products */}
        <div className="relative mt-6 h-64">
          <img
            src={hero1.image}
            alt={hero1.name}
            className="glow-product absolute left-1/2 top-0 h-64 -translate-x-1/2 animate-float-slow"
          />
          <img
            src={hero2.image}
            alt={hero2.name}
            className="glow-product absolute -left-4 bottom-0 h-28 animate-float-med"
          />
          <img
            src={hero3.image}
            alt={hero3.name}
            className="glow-product absolute -right-2 bottom-2 h-32 animate-float-slow"
          />
          <button
            onClick={openCart}
            className="absolute right-0 top-2 rounded-full bg-neon-cyan/20 px-3 py-1 text-[11px] font-semibold text-neon-cyan ring-1 ring-neon-cyan/60"
          >
            Ver carrinho
          </button>
        </div>
      </div>
    </section>
  );
}
