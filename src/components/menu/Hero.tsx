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
        {/* "Peça seu" — sans-serif, subtly handwritten italic */}
        <div
          className="mb-1 text-[22px] italic leading-none text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}
        >
          Peça seu
        </div>

        {/* Big yellow headline — slight playful twist */}
        <h1
          className="mt-1 text-[60px] uppercase leading-[0.88] tracking-[0.01em] text-neon-yellow"
          style={{
            fontFamily: "'Barlow Condensed', 'Anton', sans-serif",
            fontWeight: 900,
          }}
        >
          <span className="inline-block -rotate-[5deg]">Sorvete</span>
          <br />
          <span className="inline-block -rotate-[5deg]">Favorito</span>
        </h1>


        {/* Hand-painted pink brush blob sticker */}
        <div className="relative mt-6 w-full max-w-[280px] -rotate-[3deg]">
          <svg
            viewBox="0 0 400 130"
            className="absolute inset-0 h-full w-full drop-shadow-[0_10px_18px_-6px_rgba(236,64,122,0.55)]"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Organic wobbly brush shape */}
            <path
              d="M18,58
                 C 8,26 60,10 118,14
                 C 176,18 226,4 296,12
                 C 348,18 396,26 388,58
                 C 380,86 348,110 286,112
                 C 214,114 154,124 96,116
                 C 38,108 -4,96 18,58 Z"
              fill="oklch(0.68 0.27 350)"
            />
            {/* Soft inner highlight */}
            <path
              d="M46,42 C 130,26 260,26 350,40"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <span
            className="relative block px-8 py-5 text-center text-[19px] leading-[1.05] text-white"
            style={{
              fontFamily: "'Caveat', cursive",
              fontWeight: 700,
              textShadow: "0 2px 3px rgba(0,0,0,0.25)",
            }}
          >
            A felicidade cabe em cada colher!
          </span>
        </div>


        {/* Subtitle */}
        <p
          className="mt-5 text-[13.5px] leading-snug text-white/90"
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 400 }}
        >
          Açaí, sorvetes, milk shakes
          <br />
          e muito mais para deixar
          <br />
          seu dia{" "}
          <span className="font-bold text-neon-yellow">mais feliz!</span>
        </p>




        {/* Bottom caption — thinner "Rápido, prático e" with "delicioso!" underlined below */}
        <div className="relative mt-5 flex flex-col items-center">
          <svg
            viewBox="0 0 60 70"
            className="absolute -left-12 -top-14 h-16 w-12"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8 64 C 6 44, 14 24, 44 10" />
            <path d="M36 6 L46 8 L44 18" />
          </svg>
          <button
            onClick={onScrollMenu}
            className="flex flex-col items-center leading-tight text-white"
          >
            <span
              className="text-[12px] tracking-wide text-white/85"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300 }}
            >
              Rápido, prático e
            </span>
            <span
              className="relative mt-1 -rotate-[4deg] inline-block text-neon-pink"
              style={{ fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: "26px" }}
            >
              delicioso!
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-1 right-1 h-[3px] rounded-full bg-neon-pink"
                style={{
                  boxShadow: "0 0 8px rgba(236,64,122,0.6)",
                }}
              />
            </span>
          </button>
        </div>


        {/* Space for side illustrations */}
        <div className="h-32" />
      </div>

    </section>
  );
}
