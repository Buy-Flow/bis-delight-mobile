import { useSiteSettings, DEFAULT_HERO_IMAGES } from "@/lib/menu-data";
import { type HeroImagesConfig } from "@/lib/menu-data";
import { AdminEditButton } from "./AdminEditButton";
import { Timer, GlassWater, Heart } from "lucide-react";



export function Hero({
  onScrollMenu,
  heroImagesOverride,
}: {
  onScrollMenu: () => void;
  heroImagesOverride?: HeroImagesConfig;
}) {
  const { data: settings } = useSiteSettings();
  // Fall back to defaults so side illustrations never disappear during
  // first paint / hydration (before the settings query resolves).
  const heroImages = heroImagesOverride ?? settings?.heroImages ?? DEFAULT_HERO_IMAGES;

  return (
    <section className="relative overflow-hidden px-4 pb-0 pt-2">
      <AdminEditButton tab="settings" label="Editar hero na loja" className="absolute right-4 top-3 z-30" />

      {/* Desktop breakout layer — spans full viewport so glows/images bleed into the page background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden lg:left-1/2 lg:right-auto lg:w-screen lg:-translate-x-1/2"
      >
        {/* Pink/magenta glow behind hero images — matches the bg tone */}
        <div
          className="pointer-events-none absolute -bottom-8 -left-16 h-[380px] w-[380px] rounded-full blur-3xl lg:-left-8 lg:-bottom-16 lg:h-[720px] lg:w-[720px]"
          style={{
            background:
              "radial-gradient(closest-side, oklch(0.58 0.28 320 / 0.85), oklch(0.48 0.24 315 / 0.5) 50%, transparent 78%)",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-8 -right-16 h-[340px] w-[340px] rounded-full blur-3xl lg:-right-8 lg:-bottom-16 lg:h-[680px] lg:w-[680px]"
          style={{
            background:
              "radial-gradient(closest-side, oklch(0.58 0.28 320 / 0.85), oklch(0.48 0.24 315 / 0.5) 50%, transparent 78%)",
          }}
        />
        {/* Extra ambient glow up top on desktop to knit hero into the page bg */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 hidden h-[520px] w-[900px] -translate-x-1/2 rounded-full blur-3xl lg:block"
          style={{
            background:
              "radial-gradient(closest-side, oklch(0.42 0.22 310 / 0.55), transparent 72%)",
          }}
        />

        {/* Side illustrations — anchored to the EXACT CENTER of the container.
            Offsets are pure deltas from center, so images can never escape the
            frame unless the user explicitly pushes them past its bounds. */}
        {heroImages?.left?.url && (
          <img
            src={heroImages.left.url}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="pointer-events-none absolute z-[1] h-[480px] w-[300px] max-w-none select-none object-contain object-center sm:h-[560px] sm:w-[340px] lg:h-[820px] lg:w-[560px]"
            style={{
              top: "50%",
              left: "50%",
              transform: `translate(calc(-50% + ${heroImages.left.offsetX}px), calc(-50% + ${heroImages.left.offsetY}px)) scale(${heroImages.left.scale})`,
              transformOrigin: "center center",
              filter: "drop-shadow(0 40px 60px rgba(180, 40, 200, 0.35))",
            }}
          />
        )}
        {heroImages?.right?.url && (
          <img
            src={heroImages.right.url}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="pointer-events-none absolute z-[1] h-[410px] w-[300px] max-w-none select-none object-contain object-center sm:h-[480px] sm:w-[340px] lg:h-[760px] lg:w-[540px]"
            style={{
              top: "50%",
              left: "50%",
              transform: `translate(calc(-50% + ${heroImages.right.offsetX}px), calc(-50% + ${heroImages.right.offsetY}px)) scale(${heroImages.right.scale})`,
              transformOrigin: "center center",
              filter: "drop-shadow(0 40px 60px rgba(180, 40, 200, 0.35))",
            }}
          />
        )}

      </div>












      <div className="relative z-20 mx-auto flex w-[280px] max-w-full flex-col items-center text-center">
        {/* Eyebrow */}
        <div
          className="text-[32px] italic leading-none text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] animate-letter-wave"
          style={{ fontFamily: "'Caveat', cursive", fontWeight: 600 }}
        >
          Sabor que
        </div>


        {/* Headline */}
        <h1
          className="mt-1 whitespace-nowrap text-[44px] uppercase leading-[0.9] tracking-[0.005em] text-neon-yellow drop-shadow-[0_4px_14px_rgba(255,215,60,0.35)]"
          style={{
            fontFamily: "'Barlow Condensed', 'Anton', sans-serif",
            fontWeight: 900,
          }}
        >
          <span className="sr-only">
            Quero Bis — Sorveteria e Açaí em Ouro Preto do Oeste: sabor que transforma seu dia.
          </span>
          <span aria-hidden="true" className="stagger-letters inline-block -rotate-[3deg]">
            {"Transforma".split("").map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </span>
        </h1>



        {/* Underline swash */}
        <svg
          aria-hidden="true"
          viewBox="0 0 160 14"
          className="mt-1 h-4 w-[160px] animate-bob"
          fill="none"
        >
          <path
            d="M4 8 C 40 2, 80 12, 120 4 C 138 1, 150 6, 156 9"
            stroke="oklch(0.72 0.26 350)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        {/* Sub headline in script */}
        <div
          className="mt-3 -rotate-[2deg] text-[28px] leading-tight text-white"
          style={{
            fontFamily: "'Caveat', cursive",
            fontWeight: 700,
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          A felicidade em
          <br />
          cada <span className="text-neon-yellow animate-shimmer-text">colher.</span>
        </div>




        {/* Offer chips */}
        <div
          className="mt-5 flex flex-col items-center gap-1.5"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <div className="flex items-center justify-center gap-1.5">
            {["Açaí", "Shakes"].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm"
              >
                {chip}
              </span>
            ))}
          </div>
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm">
            Sorvetes
          </span>
        </div>

        <p
          className="mt-3 text-[14px] leading-snug text-white/75"
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 400 }}
        >
          Sabor{" "}
          <span className="font-bold text-neon-yellow">irresistível</span>
          <br />
          para o seu dia.
        </p>



        {/* Beautiful tagline strip */}
        <div className="mt-5 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-block h-[5px] w-[5px] rotate-45 bg-neon-yellow shadow-[0_0_8px_rgba(255,215,60,0.8)] animate-sparkle" />
            <span className="h-px w-5 bg-linear-to-r from-transparent via-neon-yellow/60 to-neon-yellow" />
            <button
              type="button"
              onClick={onScrollMenu}
              aria-label="Quero Bis"
              className="rounded-full border border-neon-yellow/50 bg-neon-yellow/10 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-neon-yellow shadow-[0_0_14px_rgba(255,215,60,0.4)] backdrop-blur-sm animate-pulse-glow-yellow-sm transition active:scale-95 hover:bg-neon-yellow/20 cursor-pointer"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800 }}
            >
              Quero Bis
            </button>
            <span className="h-px w-5 bg-linear-to-l from-transparent via-neon-yellow/60 to-neon-yellow" />
            <span className="inline-block h-[5px] w-[5px] rotate-45 bg-neon-yellow shadow-[0_0_8px_rgba(255,215,60,0.8)] animate-sparkle" style={{ animationDelay: "0.9s" }} />

          </div>




          <div
            className="flex flex-col items-center gap-0 -rotate-[4deg] text-white/85"
            style={{ fontFamily: "'Caveat', cursive", fontWeight: 600, fontSize: "18px", lineHeight: 1 }}
          >
            <span>Rápido</span>
            <span>Prático</span>
            <span className="text-white">&amp;</span>
            <span className="text-neon-yellow">extraordinário</span>
        </div>

        {/* Trust strip — fixed right below the "extraordinário" tagline */}
        <div
          className="relative z-20 mt-5 -mx-4 sm:-mx-8 rounded-2xl border border-white/10 bg-[oklch(0.20_0.06_300_/_0.85)] px-3 py-3 backdrop-blur-sm shadow-[0_10px_30px_-14px_rgba(0,0,0,0.7)]"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <ul className="grid grid-cols-3 gap-3 sm:gap-5 text-left">
            {[
              { Icon: Timer, tint: "text-neon-cyan", ring: "ring-neon-cyan/40", title: "Entrega rápida", sub: "em toda região" },
              { Icon: GlassWater, tint: "text-neon-pink", ring: "ring-neon-pink/40", title: "Produtos", sub: "preparados com amor" },
              { Icon: Heart, tint: "text-neon-yellow", ring: "ring-neon-yellow/40", title: "Feito com amor", sub: "os melhores ingredientes" },
            ].map(({ Icon, tint, ring, title, sub }) => (
              <li key={title} className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/5 ring-1 ${ring}`}>
                    <Icon className={`h-4 w-4 ${tint}`} strokeWidth={2.4} />
                  </span>
                  <div className="text-[11px] sm:text-[13px] font-extrabold text-white leading-tight whitespace-nowrap">
                    {title}
                  </div>
                </div>
                <div className="mt-1 text-[10px] sm:text-[11px] text-white/60 leading-tight">
                  {sub}
                </div>
              </li>
            ))}
          </ul>
        </div>






        </div>


        {/* Space for side illustrations */}
        <div className="h-4" />
      </div>

    </section>
  );
}
