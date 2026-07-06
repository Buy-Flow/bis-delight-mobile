import { ArrowRight, Sparkles } from "lucide-react";
import { BRAND, PRODUCTS } from "@/data/menu";
import { useCart } from "@/lib/cart-context";
import heroBgLeft from "@/assets/hero-bg-left.png.asset.json";
import heroBgRight from "@/assets/hero-bg-right.png.asset.json";

export function Hero({ onScrollMenu }: { onScrollMenu: () => void }) {
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

      {/* Side background images */}
      <img
        src={heroBgLeft.url}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 bottom-0 z-0 h-[300px] w-auto max-w-none opacity-90 select-none"
      />
      <img
        src={heroBgRight.url}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 bottom-0 z-0 h-[320px] w-auto max-w-none opacity-90 select-none"
      />

      <div className="relative z-10 pt-2 mx-auto flex max-w-md flex-col items-center text-center">
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

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
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
        <div className="relative mt-6 flex h-64 items-center justify-center">
          <button
            onClick={openCart}
            className="rounded-full bg-neon-cyan/20 px-4 py-2 text-[11px] font-semibold text-neon-cyan ring-1 ring-neon-cyan/60"
          >
            Ver carrinho
          </button>
        </div>

      </div>

    </section>
  );
}
