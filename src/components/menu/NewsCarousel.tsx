import { useEffect, useRef, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { Product } from "@/data/menu";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

const BADGE_STYLES = [
  { bg: "bg-neon-cyan", text: "text-[oklch(0.18_0.11_305)]", shadow: "shadow-[0_4px_0_0_oklch(0.55_0.20_200)]", rotate: "-rotate-[5deg]", label: "Novo" },
  { bg: "bg-neon-yellow", text: "text-[oklch(0.18_0.11_305)]", shadow: "shadow-[0_4px_0_0_oklch(0.65_0.18_90)]", rotate: "rotate-[4deg]", label: "Top" },
  { bg: "bg-neon-pink", text: "text-white", shadow: "shadow-[0_4px_0_0_oklch(0.45_0.24_355)]", rotate: "-rotate-[3deg]", label: "Hit" },
];

const EYEBROWS = ["Edição Limitada", "Artesanal", "Recém-chegado", "Sabor do mês"];

export function NewsCarousel({
  items,
  onOpen,
  title = "Novidades",
  subtitle = "acabou de sair!",
  ticker = "Lançamento fresquinho, Edição limitada, Só na Quero Bis, Novidade da semana",
}: {
  items: Product[];
  onOpen: (p: Product) => void;
  title?: string;
  subtitle?: string;
  ticker?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const first = el.firstElementChild as HTMLElement | null;
      if (!first) return;
      const step = first.getBoundingClientRect().width + 20;
      const idx = Math.round(el.scrollLeft / step);
      setActiveIdx(Math.min(items.length - 1, Math.max(0, idx)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [items.length]);

  // Autoplay: avança 1 card a cada 4s quando há mais de um item.
  useEffect(() => {
    if (items.length <= 1) return;
    const el = scrollerRef.current;
    if (!el) return;
    const pause = () => {
      pausedRef.current = true;
    };
    const resume = () => {
      pausedRef.current = false;
    };
    el.addEventListener("pointerdown", pause);
    el.addEventListener("pointerup", resume);
    el.addEventListener("pointercancel", resume);
    el.addEventListener("mouseleave", resume);

    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      const node = scrollerRef.current;
      if (!node) return;
      const first = node.firstElementChild as HTMLElement | null;
      if (!first) return;
      const step = first.getBoundingClientRect().width + 20;
      const currentIdx = Math.round(node.scrollLeft / step);
      const nextIdx = currentIdx + 1;
      if (nextIdx >= items.length) {
        // Volta ao início sem animação, mantendo sempre a direção direita→esquerda no modo automático.
        node.scrollTo({ left: 0, behavior: "auto" });
      } else {
        node.scrollTo({ left: nextIdx * step, behavior: "smooth" });
      }
    }, 4000);


    return () => {
      window.clearInterval(id);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("pointerup", resume);
      el.removeEventListener("pointercancel", resume);
      el.removeEventListener("mouseleave", resume);
    };
  }, [items.length]);


  return (
    <section className="relative isolate overflow-visible py-8">
      {/* Full-bleed background band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.14 0.11 305 / 0) 0%, oklch(0.18 0.14 305 / 0.85) 12%, oklch(0.20 0.16 320 / 0.9) 50%, oklch(0.18 0.14 305 / 0.85) 88%, oklch(0.14 0.11 305 / 0) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, oklch(0.72 0.26 350 / 0.55), transparent 45%), radial-gradient(circle at 85% 80%, oklch(0.85 0.18 200 / 0.45), transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.72 0.26 350 / 0.7), oklch(0.85 0.18 200 / 0.7), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.85 0.18 200 / 0.6), oklch(0.72 0.26 350 / 0.6), transparent)",
        }}
      />

      {/* Header — magazine style */}
      <div className="relative mb-3 flex items-baseline gap-3 px-5">
        <h2
          className="font-display text-[36px] font-black uppercase italic leading-none text-white"
          style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif", letterSpacing: "-0.01em" }}
        >
          Nossas{" "}
          <span className="text-neon-pink drop-shadow-[0_0_12px_rgba(255,45,149,0.85)]">
            {title}
          </span>
        </h2>
        {subtitle && (
          <span
            className="-rotate-[6deg] whitespace-nowrap text-lg text-neon-cyan drop-shadow-[0_0_6px_rgba(90,220,255,0.6)]"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            {subtitle}
          </span>
        )}
      </div>

      {/* Ticker bar */}
      {(() => {
        const tickerItems = ticker
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (tickerItems.length === 0) return null;
        const dotColors = ["bg-neon-pink", "bg-neon-cyan", "bg-neon-yellow"];
        return (
          <div className="relative mb-4 overflow-hidden py-2">
            <div className="relative flex items-center gap-2 overflow-hidden">
              <div className="flex shrink-0 animate-[news-marquee_22s_linear_infinite] gap-6 whitespace-nowrap pl-5 text-[10px] font-bold uppercase tracking-[0.28em] text-white/60">
                {Array.from({ length: 2 }).map((_, r) => (
                  <span key={r} className="flex items-center gap-6">
                    <Sparkles className="h-3 w-3 text-neon-yellow" />
                    {tickerItems.map((t, i) => (
                      <span key={`${r}-${i}`} className="flex items-center gap-6">
                        {t}
                        <span className={cn("h-1 w-1 rounded-full", dotColors[i % dotColors.length])} />
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}


      {/* Card scroller — edge-to-edge, cards ocupam quase toda a tela */}
      <div
        ref={scrollerRef}
        className="hide-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto py-6 px-[7.5vw] scroll-px-[7.5vw]"
      >
        {items.map((p, i) => (
          <NewsPosterCard
            key={p.id}
            product={p}
            onOpen={onOpen}
            badge={BADGE_STYLES[i % BADGE_STYLES.length]}
            eyebrow={EYEBROWS[i % EYEBROWS.length]}
            index={i}
          />
        ))}
      </div>

      {/* Progress rail */}
      {items.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-2 px-4">
          {items.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-[3px] rounded-full transition-all",
                i === activeIdx ? "w-10 bg-neon-pink shadow-[0_0_10px_rgba(255,45,149,0.9)]" : "w-2 bg-white/25",
              )}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes news-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

function NewsPosterCard({
  product,
  onOpen,
  badge,
  eyebrow,
  index,
}: {
  product: Product;
  onOpen: (p: Product) => void;
  badge: (typeof BADGE_STYLES)[number];
  eyebrow: string;
  index: number;
}) {
  const heroSrc = product.heroImage || product.image;

  // (issue label removed — cleaner card)

  // Split product name so we can stack it dramatically across two lines
  const words = product.name.trim().split(/\s+/);
  const topLine = words.slice(0, Math.max(1, Math.ceil(words.length / 2))).join(" ");
  const bottomLine = words.slice(Math.ceil(words.length / 2)).join(" ");

  return (
    <article className="group relative w-[85vw] max-w-[380px] shrink-0 snap-center">
      <button
        onClick={() => onOpen(product)}
        className="relative block aspect-[3/4] w-full overflow-hidden rounded-[26px] bg-[oklch(0.12_0.10_305)] text-left transition-transform duration-300 group-hover:-translate-y-1"
        style={{
          boxShadow:
            "0 0 0 1px oklch(0.72 0.26 350 / 0.35), 0 0 22px -4px oklch(0.72 0.26 350 / 0.55), 0 0 60px -18px oklch(0.85 0.18 200 / 0.55), 0 24px 40px -20px rgba(0,0,0,0.8)",
        }}
      >
        {/* Foto ocupa tudo — object-cover já preenche, sem zoom extra */}
        <img
          src={heroSrc}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />



        {/* Badge canto superior direito */}
        <div className="absolute right-3 top-3 z-20">
          <span
            className={cn(
              "inline-block rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.28em]",
              badge.bg,
              badge.text,
            )}
            style={{
              fontFamily: "'Poppins', sans-serif",
              boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            }}
          >
            {badge.label}
          </span>
        </div>

        {/* Eyebrow discreto no topo esquerdo */}
        <div className="absolute left-3 top-3 z-20">
          <span
            className="rounded-full bg-black/40 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-neon-cyan backdrop-blur"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {eyebrow}
          </span>
        </div>

        {/* Faixa inferior com wash — só o rodapé cobre a imagem */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[32%]"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.08 0.10 305 / 0) 0%, oklch(0.08 0.10 305 / 0.70) 55%, oklch(0.08 0.10 305 / 0.92) 100%)",
          }}
        />

        {/* Conteúdo compacto só no rodapé */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h3
              className="truncate text-white"
              style={{
                fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
                fontWeight: 900,
                fontStyle: "italic",
                fontSize: "22px",
                lineHeight: 1,
                letterSpacing: "-0.01em",
                textShadow: "0 2px 12px rgba(0,0,0,0.7)",
              }}
            >
              {topLine}
              {bottomLine ? ` ${bottomLine}` : ""}
            </h3>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/60"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                a partir de
              </span>
              <span
                className="text-[18px] font-black italic leading-none text-white"
                style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
              >
                {brl(product.basePrice)}
              </span>
            </div>
          </div>

          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neon-pink px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-transform group-hover:scale-105 group-active:scale-95"
            style={{
              fontFamily: "'Poppins', sans-serif",
              boxShadow: "0 0 18px rgba(255,45,149,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
            aria-hidden
          >
            Ver
            <Plus className="h-3 w-3" strokeWidth={3.2} />
          </span>
        </div>
      </button>
    </article>
  );
}


