import { useSiteSettings, DEFAULT_HERO_IMAGES } from "@/lib/menu-data";
import { type HeroImagesConfig } from "@/lib/menu-data";
import { AdminEditButton } from "./AdminEditButton";


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
    <section className="relative px-4 pb-0 pt-2">
      <AdminEditButton tab="settings" label="Editar hero na loja" className="absolute right-4 top-3 z-30" />

      {/* Desktop breakout layer — spans full viewport so glows/images bleed into the page background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 lg:left-1/2 lg:right-auto lg:w-screen lg:-translate-x-1/2"
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

      </div>

      {/* Side illustrations layer — on desktop, anchored to a centered
          max-width container so images never bleed past the viewport edge.
          On mobile/tablet the offsets remain relative to the section width
          (which matches the ~500px app column). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 lg:left-1/2 lg:right-auto lg:w-full lg:max-w-[1200px] lg:-translate-x-1/2"
      >
        {/* Side illustrations — configurable via admin (Início) */}
        {heroImages?.left?.url && (
          <img
            src={heroImages.left.url}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="pointer-events-none absolute bottom-0 h-[480px] w-[300px] max-w-none select-none object-contain object-right sm:h-[560px] sm:w-[340px] lg:h-[720px] lg:w-[480px]"
            style={{
              left: `${heroImages.left.offsetX}px`,
              bottom: `${-heroImages.left.offsetY}px`,
              transform: `scale(${heroImages.left.scale})`,
              transformOrigin: "bottom right",
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
            className="pointer-events-none absolute bottom-0 h-[410px] w-[300px] max-w-none select-none object-contain object-left sm:h-[480px] sm:w-[340px] lg:h-[680px] lg:w-[460px]"
            style={{
              right: `${heroImages.right.offsetX}px`,
              bottom: `${-heroImages.right.offsetY}px`,
              transform: `scale(${heroImages.right.scale})`,
              transformOrigin: "bottom left",
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
          className="mt-5 flex w-full items-center justify-center gap-1.5"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {["Açaí", "Shakes", "Sorvetes"].map((chip) => (
            <span
              key={chip}
              className="whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.10em] text-white/90 backdrop-blur-sm"
            >
              {chip}
            </span>
          ))}
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

        </div>


        {/* Space for side illustrations */}
        <div className="h-4" />
      </div>

    </section>
  );
}
