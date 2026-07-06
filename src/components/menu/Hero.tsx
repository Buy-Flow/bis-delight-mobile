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

      <div className="relative z-20 mx-auto flex max-w-[300px] flex-col items-center px-6 text-center">
        {/* Eyebrow */}
        <div
          className="mb-1 text-[22px] italic leading-none text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}
        >
          Sabor que
        </div>

        {/* Big yellow headline */}
        <h1
          className="mt-1 text-[60px] uppercase leading-[0.88] tracking-[0.01em] text-neon-yellow"
          style={{
            fontFamily: "'Barlow Condensed', 'Anton', sans-serif",
            fontWeight: 900,
          }}
        >
          <span className="inline-block -rotate-[5deg]">Transforma!</span>
          <span className="ml-1 inline-block text-[42px]">🍦</span>
        </h1>

        {/* Decorative typographic phrase */}
        <div className="relative mt-6 w-full max-w-[300px] text-center">
          <svg
            aria-hidden="true"
            viewBox="0 0 300 130"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <g transform="translate(18 22)" fill="oklch(0.92 0.20 100)">
              <path d="M6 0 L7.5 4.5 L12 6 L7.5 7.5 L6 12 L4.5 7.5 L0 6 L4.5 4.5 Z" />
            </g>
            <g transform="translate(268 14)" fill="oklch(0.72 0.26 350)">
              <path d="M5 0 L6.2 3.8 L10 5 L6.2 6.2 L5 10 L3.8 6.2 L0 5 L3.8 3.8 Z" />
            </g>
            <circle cx="286" cy="70" r="2" fill="oklch(0.86 0.18 200)" />
            <circle cx="10" cy="72" r="2" fill="oklch(0.92 0.20 100)" />
            <circle cx="30" cy="100" r="1.5" fill="rgba(255,255,255,0.7)" />
            <circle cx="272" cy="106" r="1.5" fill="rgba(255,255,255,0.7)" />
          </svg>

          <div
            className="-rotate-[3deg] text-[28px] leading-none text-white"
            style={{
              fontFamily: "'Caveat', cursive",
              fontWeight: 700,
              textShadow: "0 2px 8px rgba(0,0,0,0.45)",
            }}
          >
            A felicidade
          </div>

          <div
            className="mt-1.5 text-[11px] uppercase tracking-[0.32em] text-white/70"
            style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}
          >
            em cada
          </div>

          <div className="relative mt-1 inline-block">
            <span
              className="relative z-10 inline-block rotate-[2deg] text-[34px] leading-none text-neon-yellow"
              style={{
                fontFamily: "'Caveat', cursive",
                fontWeight: 700,
                textShadow: "0 3px 10px rgba(255,215,60,0.35), 0 2px 3px rgba(0,0,0,0.35)",
              }}
            >
              colher.
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 140 22"
              className="absolute -bottom-2 left-1/2 h-4 w-[120px] -translate-x-1/2"
              fill="none"
            >
              <path
                d="M4 12 C 30 2, 70 22, 110 6 C 122 2, 132 6, 136 12"
                stroke="oklch(0.72 0.26 350)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Offer list */}
        <p
          className="mt-6 text-[13.5px] leading-snug text-white/90"
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 400 }}
        >
          Açaí, Sorvetes Premium,
          <br />
          Milkshakes e muito mais.
          <br />
          Qualidade{" "}
          <span className="font-bold text-neon-yellow">irresistível</span>{" "}
          para o seu dia.
        </p>

        {/* CTA */}
        <div className="relative mt-6 flex flex-col items-center">
          <button
            onClick={onScrollMenu}
            className="flex flex-col items-center leading-tight text-white"
          >
            <span
              className="text-[13px] tracking-wide text-white/90"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}
            >
              Peça o seu agora! 🚀
            </span>
            <span
              className="relative mt-1 -rotate-[4deg] inline-block text-neon-pink"
              style={{ fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: "26px" }}
            >
              extraordinário!
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-1 right-1 h-[3px] rounded-full bg-neon-pink"
                style={{
                  boxShadow: "0 0 8px rgba(236,64,122,0.6)",
                }}
              />
            </span>
            <span
              className="mt-1 text-[11px] tracking-wide text-white/70"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300 }}
            >
              Rápido e prático
            </span>
          </button>
        </div>

        {/* Space for side illustrations */}
        <div className="h-32" />
      </div>

    </section>
  );
}
