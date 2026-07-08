import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { useCart } from "@/lib/cart-context";
import { TopBar } from "@/components/menu/TopBar";
import { Hero } from "@/components/menu/Hero";
import { Benefits } from "@/components/menu/Benefits";
import { CategoryStrip } from "@/components/menu/CategoryStrip";
import { ProductCard } from "@/components/menu/ProductCard";
import { HighlightCard } from "@/components/menu/HighlightCard";
import { NewsCarousel } from "@/components/menu/NewsCarousel";
import { LocationSection } from "@/components/menu/LocationSection";
import { FloatingActions } from "@/components/menu/FloatingActions";
import { Reveal } from "@/components/Reveal";
import { BRAND, type Product } from "@/data/menu";
import { useProducts, useSiteSettings } from "@/lib/menu-data";
import heroTexture from "@/assets/purple-crumpled-bg.png.asset.json";
import monteAcaiImg from "@/assets/monte-acai.png.asset.json";
import { Search, Sparkles, X, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
// CartSheet is eager-loaded so tapping "Ver carrinho" on mobile is instant
import { CartSheet } from "@/components/menu/CartSheet";

const ProductModal = lazy(() =>
  import("@/components/menu/ProductModal").then((m) => ({ default: m.ProductModal })),
);
const CustomProductBuilder = lazy(() =>
  import("@/components/menu/CustomProductBuilder").then((m) => ({ default: m.CustomProductBuilder })),
);
const CheckoutSheet = lazy(() =>
  import("@/components/menu/CheckoutSheet").then((m) => ({ default: m.CheckoutSheet })),
);






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
    <>
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
    </>
  );
}


function Content() {
  const [activeCat, setActiveCat] = useState("all");
  const [query, setQuery] = useState("");
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [customProduct, setCustomProduct] = useState<Product | null>(null);
  const { isCartOpen, isCheckoutOpen } = useCart();

  const openProduct = (p: Product) => {
    if (p.isCustom) setCustomProduct(p);
    else setModalProduct(p);
  };
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: products = [], isLoading: productsLoading, error: productsError } = useProducts();
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useSiteSettings();
  const newsLoading = settingsLoading || productsLoading;
  const newsError = settingsError || productsError;

  const scrollToMenu = () => {
    document.getElementById("categorias")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToFeitoComAmor = () => {
    document.getElementById("feito-com-amor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };


  const highlights = useMemo(() => products.filter((p) => p.hero), [products]);
  const newsItems = useMemo(() => {
    const ids = settings?.newsProductIds ?? [];
    if (!ids.length) return [];
    const byId = new Map(products.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is typeof products[number] => Boolean(p));
  }, [products, settings?.newsProductIds]);
  const filtered = useMemo(() => {
    const byCat = activeCat === "all" ? products : products.filter((p) => p.category === activeCat);
    const q = query.trim().toLowerCase();
    if (!q) return byCat;
    return byCat.filter((p) => {
      const hay = `${p.name} ${p.description ?? ""} ${(p.ingredients ?? []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeCat, query, products]);



  const textureSizeCss = (() => {
    switch (settings?.textureSize) {
      case "small": return "200px";
      case "medium": return "400px";
      case "large": return "800px";
      case "contain": return "contain";
      default: return "cover";
    }
  })();
  const themeStyle = {
    "--accent": settings?.accentColor ?? "#ffe600",
    "--card-radius": `${settings?.cardRadius ?? 24}px`,
    "--card-glow": settings?.cardGlow ? `0 0 24px ${settings?.accentColor ?? "#ffe600"}66` : "none",
    "--card-border": settings?.cardBorder ? `1px solid ${(settings?.accentColor ?? "#ffe600")}55` : "1px solid transparent",
    "--title-font": `'${settings?.titleFont ?? "Barlow Condensed"}', 'Poppins', sans-serif`,
  } as React.CSSProperties;

  return (
      <div
        className="relative mx-auto min-h-screen w-full max-w-[520px] overflow-hidden"
        style={{
          background:
            "radial-gradient(140% 900px at 50% 0%, oklch(0.24 0.15 305 / 0.92), transparent 68%), radial-gradient(120% 760px at 50% 34%, oklch(0.22 0.14 305 / 0.58), transparent 72%), linear-gradient(180deg, oklch(0.11 0.08 305) 0%, oklch(0.16 0.11 305) 28%, oklch(0.14 0.10 305) 58%, oklch(0.10 0.07 305) 100%)",
          backgroundColor: settings?.bgColor ?? "#0d0322",
          ...themeStyle,
        }}
      >
      {/* Textura de fundo — camada separada para permitir opacidade */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute -inset-6"
          style={{
            backgroundImage: `url(${settings?.texture || heroTexture.url})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
            opacity: Math.min(settings?.textureOpacity ?? 0.10, 0.10),
            filter: "blur(32px) saturate(0.75)",
            transform: "scale(1.16)",
          }}
        />
      </div>
      {/* Blend suave — remove faixas duras entre repetições da textura e transições de seção */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.13 0.09 305 / 0.42) 0%, oklch(0.18 0.12 305 / 0.18) 26%, oklch(0.16 0.11 305 / 0.12) 58%, oklch(0.10 0.07 305 / 0.48) 100%), radial-gradient(150% 980px at 50% 18%, oklch(0.28 0.16 305 / 0.22), transparent 76%), radial-gradient(150% 980px at 50% 58%, oklch(0.20 0.13 305 / 0.18), transparent 78%)",
        }}
      />


      <div className="relative">


      {settings?.announcementActive && settings?.announcementText && (
        <div className="flex items-center justify-center gap-2 bg-neon-yellow px-4 py-2 text-center text-[12px] font-bold text-[oklch(0.15_0.10_305)]">
          <Megaphone className="h-3.5 w-3.5 shrink-0" />
          <span>{settings.announcementText}</span>
        </div>
      )}

      <TopBar onOpenCategories={scrollToFeitoComAmor} />
      <Hero onScrollMenu={scrollToMenu} />
      <Reveal><Benefits /></Reveal>
      
      

      {/* Novidades — faixa full-bleed */}
      {settings?.newsActive && (
        <Reveal as="section" className="relative -mx-4 sm:-mx-6 md:-mx-8 overflow-visible">
          {newsLoading ? (
            <div className="flex gap-5 overflow-visible px-4 py-10" aria-label="Carregando novidades" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[380px] w-[85vw] max-w-[420px] shrink-0 animate-pulse rounded-[28px] bg-white/5 ring-1 ring-white/10"
                />
              ))}
            </div>
          ) : newsError ? (
            <div className="mx-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-center text-sm text-red-200" role="alert">
              Não foi possível carregar as novidades. Tente novamente em instantes.
            </div>
          ) : newsItems.length > 0 ? (
            <NewsCarousel
              items={newsItems}
              onOpen={openProduct}
              title={settings.newsTitle || "Novidades"}
              subtitle={settings.newsSubtitle}
              ticker={settings.newsTicker}
            />
          ) : (
            <div className="mx-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/70">
              Nenhuma novidade por aqui ainda. Volte em breve!
            </div>
          )}
        </Reveal>
      )}



      {/* Highlights */}
      <Reveal><HighlightsCarousel highlights={highlights} onOpen={openProduct} /></Reveal>

      {/* Monte seu açaí banner */}
      <Reveal as="section" className="px-4 py-6">
        <button
          onClick={() => {
            const monte = products.find((p) => p.id === "monte-acai" || p.isCustom);
            if (monte) setCustomProduct(monte);
          }}
          className="shine-strip group relative flex w-full items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[oklch(0.28_0.18_305)] via-[oklch(0.20_0.14_305)] to-[oklch(0.14_0.10_300)] p-4 text-left ring-1 ring-neon-pink/25 active:scale-[.99]"
        >
          <div className="relative z-10">
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-neon-yellow px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-widest text-[oklch(0.18_0.11_305)]">
              <Sparkles className="h-3 w-3 animate-spin-slow" /> Novo
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
            src={monteAcaiImg.url}
            alt="Monte seu açaí"
            loading="lazy"
            width={1024}
            height={1024}
            className="ml-auto h-32 w-32 shrink-0 object-contain drop-shadow-[0_15px_20px_rgba(0,0,0,0.5)] animate-float-slow"
          />
        </button>
      </Reveal>










      {/* Product list */}
      <section ref={menuRef} className="px-4 pb-28">

        <div id="feito-com-amor" className="mb-4 scroll-mt-20">

          <div className="flex items-center justify-center gap-3">
            <span className="h-[2px] w-8 rounded-full bg-linear-to-r from-transparent to-neon-pink" />
            <span
              className="text-[11px] uppercase tracking-[0.4em] text-neon-pink animate-letter-wave"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800 }}
            >
              Feito com amor
            </span>
            <span className="h-[2px] w-8 rounded-full bg-linear-to-l from-transparent to-neon-pink" />

          </div>
          <h2
            className="mt-1 text-center font-display text-[34px] font-black uppercase leading-[0.95] text-white"
            style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif", letterSpacing: "0.01em" }}
          >
            {activeCat === "all" ? (
              <>
                Nosso{" "}
                <span className="relative inline-block">
                <span className="relative z-10 text-neon-yellow drop-shadow-[0_4px_14px_rgba(255,215,60,0.45)] animate-shimmer-text">
                    cardápio
                  </span>

                  <svg
                    aria-hidden="true"
                    viewBox="0 0 160 14"
                    className="absolute -bottom-1 left-0 h-3 w-full"
                    fill="none"
                  >
                    <path
                      d="M4 8 C 40 2, 80 12, 120 4 C 138 1, 150 6, 156 9"
                      stroke="oklch(0.72 0.26 350)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </>
            ) : (
              <span className="text-neon-yellow">{filtered[0]?.category ?? ""}</span>
            )}
          </h2>
          <div
            className="mt-2 flex items-center justify-center gap-2 text-white/70"
            style={{ fontFamily: "'Caveat', cursive", fontWeight: 600, fontSize: "18px" }}
          >
            <span className="inline-block h-[5px] w-[5px] rotate-45 bg-neon-cyan shadow-[0_0_8px_rgba(0,229,255,0.9)] animate-sparkle" />
            <span className="-rotate-[2deg]">
              {filtered.length} delícias para adoçar seu dia
            </span>
            <span className="inline-block h-[5px] w-[5px] rotate-45 bg-neon-yellow shadow-[0_0_8px_rgba(255,215,60,0.9)] animate-sparkle" style={{ animationDelay: "0.9s" }} />

          </div>
        </div>

        {/* Search bar */}
        <div className="mb-4">
          <div className="group relative">
            <div
              className="pointer-events-none absolute -inset-[1px] rounded-full opacity-70 blur-md transition group-focus-within:opacity-100"
              style={{
                background:
                  "linear-gradient(90deg, oklch(0.72 0.26 350 / 0.55), oklch(0.86 0.18 200 / 0.55), oklch(0.82 0.19 90 / 0.55))",
              }}
            />
            <div className="relative flex items-center gap-2 rounded-full border border-white/10 bg-[oklch(0.14_0.09_305)]/85 pl-4 pr-1.5 py-1.5 backdrop-blur-md shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
              <Search className="h-4 w-4 shrink-0 text-neon-cyan" strokeWidth={2.5} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar sabor, sorvete, açaí…"
                className="min-w-0 flex-1 bg-transparent py-2 text-[13.5px] text-white placeholder:text-white/45 outline-none"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Limpar busca"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 active:scale-95"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          {query && (
            <div
              className="mt-2 text-center text-[11px] text-white/60"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {filtered.length} resultado{filtered.length === 1 ? "" : "s"} para
              <span className="ml-1 font-semibold text-neon-yellow">"{query}"</span>
            </div>
          )}
        </div>

        {/* Categories under search */}
        <div className="-mx-4 mb-2">
          <CategoryStrip active={activeCat} onChange={setActiveCat} />
        </div>

        <div className="grid grid-cols-2 gap-3">


          {filtered.map((p, i) => (
            <div
              key={p.id}
              className="animate-rise-in h-full"
              style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
            >
              <ProductCard product={p} onOpen={openProduct} />
            </div>
          ))}
        </div>
      </section>

      <LocationSection />

      <footer className="border-t border-white/5 px-4 py-8 text-center">
        <Link
          to="/admin"
          className="block text-[10px] text-white/30 transition-colors hover:text-white/60"
        >
          © {new Date().getFullYear()} {settings?.name ?? BRAND.name} · Feito com <span className="inline-block animate-heartbeat">💜</span>
        </Link>
      </footer>



      <FloatingActions />
      <Suspense fallback={null}>
        {modalProduct && (
          <ProductModal product={modalProduct} onClose={() => setModalProduct(null)} />
        )}
        {customProduct && (
          <CustomProductBuilder
            product={customProduct}
            onClose={() => setCustomProduct(null)}
          />
        )}
        {isCartOpen && <CartSheet />}
        {isCheckoutOpen && <CheckoutSheet />}
      </Suspense>

      </div>
    </div>
  );
}

function HighlightsCarousel({
  highlights,
  onOpen,
  titleLead = "Nossos",
  titleAccent = "Destaques",
  accentColor = "yellow",
  hideHeader = false,
}: {
  highlights: Product[];
  onOpen: (p: Product) => void;
  titleLead?: string;
  titleAccent?: string;
  accentColor?: "yellow" | "cyan" | "pink";
  hideHeader?: boolean;
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

    // Desktop: converte scroll vertical do mouse em rolagem lateral
    const isFinePointer =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: fine)").matches;
    const onWheel = (e: WheelEvent) => {
      if (!isFinePointer) return;
      if (e.deltaY === 0) return;
      const delta =
        Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;
      const atStart = el.scrollLeft <= 0 && delta < 0;
      const atEnd = el.scrollLeft >= maxScroll - 1 && delta > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollBy({ left: delta, behavior: "auto" });
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
    };
  }, [highlights.length]);

  const scrollTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth * 0.88, behavior: "smooth" });
  };

  const accent = {
    yellow: {
      text: "text-neon-yellow",
      shadow: "drop-shadow-[0_4px_14px_rgba(255,215,60,0.45)]",
      stroke: "oklch(0.72 0.26 350)",
      dot: "bg-neon-pink",
    },
    cyan: {
      text: "text-neon-cyan",
      shadow: "drop-shadow-[0_4px_14px_rgba(90,220,255,0.45)]",
      stroke: "oklch(0.80 0.16 200)",
      dot: "bg-neon-cyan",
    },
    pink: {
      text: "text-neon-pink",
      shadow: "drop-shadow-[0_4px_14px_rgba(255,90,170,0.45)]",
      stroke: "oklch(0.72 0.26 350)",
      dot: "bg-neon-pink",
    },
  }[accentColor];

  return (
      <section className="overflow-visible pb-4 pt-2">
      {!hideHeader && (
        <div className="mb-3 px-4 text-center">
          <h2
            className="font-display text-[34px] font-black uppercase leading-[0.95] text-white"
            style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif", letterSpacing: "0.01em" }}
          >
            {titleLead}{" "}
            <span className="relative inline-block">
              <span className={cn("relative z-10", accent.text, accent.shadow)}>
                {titleAccent}
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 160 14"
                className="absolute -bottom-1 left-0 h-3 w-full"
                fill="none"
              >
                <path
                  d="M4 8 C 40 2, 80 12, 120 4 C 138 1, 150 6, 156 9"
                  stroke={accent.stroke}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h2>
        </div>
      )}




      <div
        ref={scrollerRef}
        className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-8 px-8 py-8"
        style={{
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0, black 34px, black calc(100% - 34px), transparent 100%)",
          maskImage:
            "linear-gradient(90deg, transparent 0, black 34px, black calc(100% - 34px), transparent 100%)",
        }}
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
                ? cn("w-5", accent.dot)
                : "w-1.5 bg-white/30",
            )}
          />
        ))}
      </div>
    </section>
  );
}

