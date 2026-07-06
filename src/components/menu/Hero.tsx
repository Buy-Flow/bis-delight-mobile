import heroBgLeft from "@/assets/hero-bg-left.png.asset.json";
import heroBgRight from "@/assets/hero-bg-right.png.asset.json";

export function Hero({ onScrollMenu }: { onScrollMenu: () => void }) {


  return (
    <section className="relative overflow-hidden px-4 pb-0 pt-2">
      {/* Side ice cream illustrations */}
      <img
        aria-hidden="true"
        src={heroBgLeft.url}
        alt=""
        className="pointer-events-none absolute left-0 -top-8 z-0 h-[760px] w-auto max-w-none select-none object-contain object-left"
      />
      <img
        aria-hidden="true"
        src={heroBgRight.url}
        alt=""
        className="pointer-events-none absolute right-0 top-0 z-0 h-[760px] w-auto max-w-none select-none object-contain object-right"
      />





      <div className="relative z-20 mx-auto flex w-[220px] max-w-full flex-col items-center text-center">
        {/* Eyebrow */}
        <div
          className="text-[26px] italic leading-none text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
          style={{ fontFamily: "'Caveat', cursive", fontWeight: 600 }}
        >
          Sabor que
        </div>

        {/* Headline */}
        <h1
          className="mt-1 text-[42px] uppercase leading-[0.9] tracking-[0.005em] text-neon-yellow drop-shadow-[0_4px_14px_rgba(255,215,60,0.35)]"
          style={{
            fontFamily: "'Barlow Condensed', 'Anton', sans-serif",
            fontWeight: 900,
          }}
        >
          <span className="inline-block -rotate-[3deg]">Transforma</span>
        </h1>


        {/* Underline swash */}
        <svg
          aria-hidden="true"
          viewBox="0 0 160 14"
          className="mt-1 h-4 w-[160px]"
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
          className="mt-3 -rotate-[2deg] text-[22px] leading-tight text-white"
          style={{
            fontFamily: "'Caveat', cursive",
            fontWeight: 700,
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          A felicidade em
          <br />
          cada <span className="text-neon-yellow">colher.</span>
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
                className="rounded-full border border-white/20 bg-white/10 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm"
              >
                {chip}
              </span>
            ))}
          </div>
          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm">
            Sorvetes
          </span>
        </div>

        <p
          className="mt-3 text-[12px] leading-snug text-white/75"
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 400 }}
        >
          Qualidade{" "}
          <span className="font-bold text-neon-yellow">irresistível</span>
          <br />
          para o seu dia.
        </p>


        {/* Beautiful tagline strip */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <span
            className="-rotate-[3deg] px-1 text-[34px] leading-none text-neon-yellow"
            style={{
              fontFamily: "'Titan One', 'Bowlby One', 'Fredoka', sans-serif",
              fontWeight: 400,
              letterSpacing: "0.01em",
              WebkitTextStroke: "2.5px #1a0b2e",
              paintOrder: "stroke fill",
              textShadow:
                "0 3px 0 #1a0b2e, 0 5px 0 #1a0b2e, 0 7px 14px rgba(0,0,0,0.55), 0 0 22px rgba(255,215,60,0.55)",
            }}
          >
            Quero Bis
          </span>
          <div
            className="flex flex-col items-center gap-0 -rotate-[4deg] text-white/85"
            style={{ fontFamily: "'Caveat', cursive", fontWeight: 600, fontSize: "14px", lineHeight: 1 }}
          >
            <span>Rápido</span>
            <span>Prático</span>
            <span className="text-white">&amp;</span>
            <span className="text-neon-yellow">extraordinário</span>
          </div>
        </div>


        {/* Space for side illustrations */}
        <div className="h-28" />
      </div>

    </section>
  );
}
