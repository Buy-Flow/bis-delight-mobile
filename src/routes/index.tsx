import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { CartProvider, useCart } from "@/lib/cart-context";
import { TopBar } from "@/components/menu/TopBar";
import { Hero } from "@/components/menu/Hero";
import { Benefits } from "@/components/menu/Benefits";
import { CategoryStrip } from "@/components/menu/CategoryStrip";
import { ProductCard } from "@/components/menu/ProductCard";
import { ProductModal } from "@/components/menu/ProductModal";
import { AcaiBuilder } from "@/components/menu/AcaiBuilder";
import { CartSheet } from "@/components/menu/CartSheet";
import { CheckoutSheet } from "@/components/menu/CheckoutSheet";
import { LocationSection } from "@/components/menu/LocationSection";
import { FloatingActions } from "@/components/menu/FloatingActions";
import { PRODUCTS, BRAND, type Product } from "@/data/menu";
import { Sparkles, Flame } from "lucide-react";

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
    <div className="relative mx-auto min-h-screen w-full max-w-[520px] pb-32">
      <TopBar onOpenCategories={scrollToMenu} />
      <Hero onScrollMenu={scrollToMenu} />
      <Benefits />
      <CategoryStrip active={activeCat} onChange={setActiveCat} />

      {/* Highlights */}
      <section className="px-4 pb-2">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl font-extrabold text-white flex items-center gap-2">
            <Flame className="h-5 w-5 text-neon-pink" /> Destaques
          </h2>
          <span className="text-[11px] uppercase tracking-widest text-neon-cyan">
            Mais pedidos
          </span>
        </div>
        <div className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {highlights.map((p) => (
            <div key={p.id} className="w-[70%] shrink-0 snap-start">
              <ProductCard product={p} onOpen={setModalProduct} />
            </div>
          ))}
        </div>
      </section>

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
        <div className="font-display text-2xl font-extrabold text-neon-yellow glow-yellow-text">
          Quero<span className="text-neon-pink">Bis</span>
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-widest text-white/50">
          Sorveteria & Açaí
        </div>
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
