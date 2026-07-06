import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { CartProvider, useCart } from "@/lib/cart-context";
import { TopBar } from "@/components/menu/TopBar";
import { Hero } from "@/components/menu/Hero";
import { Benefits } from "@/components/menu/Benefits";
import { CategoryStrip } from "@/components/menu/CategoryStrip";
import { ProductCard } from "@/components/menu/ProductCard";
import { HighlightCard } from "@/components/menu/HighlightCard";
import { ProductModal } from "@/components/menu/ProductModal";
import { AcaiBuilder } from "@/components/menu/AcaiBuilder";
import { CartSheet } from "@/components/menu/CartSheet";
import { CheckoutSheet } from "@/components/menu/CheckoutSheet";
import { LocationSection } from "@/components/menu/LocationSection";
import { FloatingActions } from "@/components/menu/FloatingActions";
import { PRODUCTS, BRAND, type Product } from "@/data/menu";
import heroTexture from "@/assets/bg-purple-dark.png.asset.json";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quero Bis — Sorveteria & Açaí | Cardápio Digital" },
      {
        name: "description",
        content:
          "Peça sorvetes, açaí e milk shakes da Quero Bis em Ouro Preto do Oeste. Monte seu açaí, personalize e receba em casa pelo WhatsApp.",
      },
      { property: "og:title", content: "Quero Bis — Cardápio Digital" },
      {
        property: "og:description",
        content: "Sorvetes, açaí, taças e milk shakes. Peça pelo WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <CartProvider>
      <Content />
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          style: {
            background: "oklch(0.24 0.14 305)",
            border: "1px solid oklch(0.86 0.18 200 / 0.35)",
            color: "white",
          },
        }}
      />
    </CartProvider>
  );
}

function Content() {
  const [activeCat, setActiveCat] = useState("all");
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const { isAcaiOpen, openAcai, closeAcai } = useCart();
  const menuRef = useRef<HTMLDivElement>(null);

  const scrollToMenu = () => {
    document.getElementById("categorias")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const highlights = useMemo(() => PRODUCTS.filter((p) => p.hero), []);
  const filtered = useMemo(
    () => (activeCat === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === activeCat)),
    [activeCat],
  );

  return (
    <div
      className="relative mx-auto min-h-screen w-full max-w-[520px] pb-32"
      style={{
        backgroundImage: `url(${heroTexture.url})`,
        backgroundSize: "cover",
        backgroundRepeat: "repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <TopBar onOpenCategories={scrollToMenu} />
      <Hero onScrollMenu={scrollToMenu} />
      <Benefits />
      <CategoryStrip active={activeCat} onChange={setActiveCat} />

      {/* Highlights */}
      <HighlightsCarousel highlights={highlights} onOpen={setModalProduct} />


      {/* Monte seu açaí banner */}
      <section className="px-4 py-6">
        <button
          onClick={openAcai}
          className="shine-strip group relative flex w-full items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[oklch(0.35_0.24_310)] via-[oklch(0.28_0.20_320)] to-[oklch(0.20_0.15_305)] p-4 text-left ring-1 ring-neon-cyan/30 active:scale-[.99]"
        >
          <div className="relative z-10">
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-neon-yellow px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-widest text-[oklch(0.18_0.11_305)]">
              <Sparkles className="h-3 w-3" /> Novo
            </div>
            <div className="font-display text-2xl font-extrabold leading-tight text-white">
              Monte seu <span className="text-neon-pink">açaí</span>
            </div>
            <div className="text-[12px] text-white/70">Escolha frutas, cremes e complementos.</div>
            <div className="mt-3 inline-block rounded-full bg-neon-cyan px-3 py-1.5 text-[12px] font-extrabold text-[oklch(0.18_0.11_305)]">
              Começar →
            </div>
          </div>
          <img
            src={PRODUCTS.find((p) => p.id === "acai-turbinado")!.image}
            alt="Monte seu açaí"
            className="ml-auto h-32 w-32 shrink-0 object-contain drop-shadow-[0_15px_20px_rgba(0,0,0,0.5)] animate-float-slow"
          />
        </button>
      </section>

      {/* Product list */}
      <section ref={menuRef} className="px-4 pb-6">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl font-extrabold text-white">
            {activeCat === "all"
              ? "Nosso cardápio"
              : `Categoria: ${filtered[0]?.category ?? ""}`}
          </h2>
          <span className="text-[11px] text-white/50">{filtered.length} itens</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p, i) => (
            <div
              key={p.id}
              className="animate-rise-in"
              style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
            >
              <ProductCard product={p} onOpen={setModalProduct} />
            </div>
          ))}
        </div>
      </section>

      <LocationSection />

      <footer className="border-t border-white/5 px-4 py-8 text-center">
        <img
          src={BRAND.logo}
          alt="Quero Bis — Sorveteria e Açaí"
          className="mx-auto h-24 w-auto drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]"
        />
        <div className="mt-4 text-[12px] text-white/60">{BRAND.address}</div>
        <div className="mt-1 text-[12px] text-white/60">{BRAND.whatsappDisplay}</div>
        <div className="mt-6 text-[10px] text-white/30">
          © {new Date().getFullYear()} Quero Bis · Feito com 💜 em Ouro Preto do Oeste
        </div>
      </footer>

      <FloatingActions />
      <ProductModal product={modalProduct} onClose={() => setModalProduct(null)} />
      {isAcaiOpen && <AcaiBuilder onClose={closeAcai} />}
      <CartSheet />
      <CheckoutSheet />
    </div>
  );
}

function HighlightsCarousel({
  highlights,
  onOpen,
}: {
  highlights: Product[];
  onOpen: (p: Product) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / (el.clientWidth * 0.88));
      setActiveIdx(Math.min(highlights.length - 1, Math.max(0, idx)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [highlights.length]);

  const scrollTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth * 0.88, behavior: "smooth" });
  };

  return (
    <section className="pb-4 pt-2">
      <div className="mb-3 flex items-center justify-center gap-3 px-4">
        <span className="text-neon-pink">›</span>
        <h2 className="font-display text-[13px] font-extrabold uppercase tracking-[0.2em] text-white">
          Nossos Destaques
        </h2>
        <span className="text-neon-pink rotate-180">›</span>
      </div>

      <div
        ref={scrollerRef}
        className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-3"
      >
        {highlights.map((p) => (
          <div key={p.id} className="w-[88%] shrink-0 snap-start">
            <HighlightCard product={p} onOpen={onOpen} />
          </div>
        ))}
      </div>

      <div className="mt-1 flex items-center justify-center gap-1.5">
        {highlights.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            aria-label={`Ir para destaque ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === activeIdx
                ? "w-5 bg-neon-pink"
                : "w-1.5 bg-white/30",
            )}
          />
        ))}
      </div>
    </section>
  );
}

