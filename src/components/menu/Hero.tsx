import heroBgLeft from "@/assets/hero-bg-left.png.asset.json";
import heroBgRight from "@/assets/hero-bg-right.png.asset.json";

export function Hero({ onScrollMenu }: { onScrollMenu: () => void }) {


  return (
    <section className="relative overflow-hidden px-4 pb-10 pt-2">
      {/* Side ice cream illustrations */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-16 z-0 select-none"
        style={{
          width: "128px",
          height: "360px",
          backgroundImage: `url(${heroBgLeft.url})`,
          backgroundSize: "440px auto",
          backgroundPosition: "-10px -140px",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-24 z-0 select-none"
        style={{
          width: "128px",
          height: "360px",
          backgroundImage: `url(${heroBgRight.url})`,
          backgroundSize: "410px auto",
          backgroundPosition: "-278px -150px",
          backgroundRepeat: "no-repeat",
        }}
      />

      <div className="relative z-20 mx-auto flex w-[170px] max-w-full flex-col items-center text-center">
        {/* Eyebrow */}
        <div
          className="text-[20px] italic leading-none text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
          style={{ fontFamily: "'Caveat', cursive", fontWeight: 600 }}
        >
          Sabor que
        </div>

        {/* Headline */}
        <h1
          className="mt-1 text-[30px] uppercase leading-[0.9] tracking-[0.005em] text-neon-yellow drop-shadow-[0_4px_14px_rgba(255,215,60,0.35)]"
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
          className="mt-1 h-3 w-[120px]"
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
          className="mt-3 -rotate-[2deg] text-[16px] leading-tight text-white"
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
          className="mt-5 flex flex-wrap items-center justify-center gap-1.5"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {["Açaí", "Sorvetes", "Shakes"].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-white/20 bg-white/10 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm"
            >
              {chip}
            </span>
          ))}
        </div>

        <p
          className="mt-3 text-[12px] leading-snug text-white/75"
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 400 }}
        >
          Qualidade{" "}
          <span className="font-bold text-neon-yellow">irresistível</span>{" "}
          para o seu dia.
        </p>


        {/* Beautiful tagline strip */}
        <div className="mt-5 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <span className="h-px w-6 bg-linear-to-r from-transparent to-neon-pink/70" />
            <span
              className="text-[9.5px] uppercase tracking-[0.35em] text-neon-pink"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}
            >
              Quero Bis
            </span>
            <span className="h-px w-6 bg-linear-to-l from-transparent to-neon-pink/70" />
          </div>
          <div
            className="flex items-center gap-2 text-[10px] uppercase text-white/85"
            style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, letterSpacing: "0.18em" }}
          >
            <span>Rápido</span>
            <span className="inline-block h-1 w-1 rotate-45 bg-neon-yellow" />
            <span>Prático</span>
            <span className="inline-block h-1 w-1 rotate-45 bg-neon-cyan" />
            <span
              className="text-neon-yellow"
              style={{ fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: "16px", letterSpacing: "0", textTransform: "none" }}
            >
              extraordinário
            </span>
          </div>
        </div>

        {/* Space for side illustrations */}
        <div className="h-28" />
      </div>

    </section>
  );
}
