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


        {/* Pink brush-stroke banner (two-line) with tapered ends */}
        <div className="relative mt-6 w-full max-w-[300px] -rotate-[3deg]">
          <svg
            viewBox="0 0 400 130"
            className="absolute inset-0 h-full w-full drop-shadow-[0_10px_18px_-6px_rgba(236,64,122,0.55)]"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Rough brush shape with tapered/frayed left + right ends */}
            <path
              d="M6,68
                 C 2,50 14,38 34,34
                 C 70,26 120,24 180,22
                 C 240,20 300,26 356,30
                 C 384,32 400,44 394,66
                 C 388,86 372,96 344,100
                 C 292,108 220,112 156,112
                 C 104,112 56,108 28,102
                 C 8,98 -2,84 6,68 Z"
              fill="oklch(0.68 0.27 350)"
            />
            {/* Textured speckle strokes (brush grain) */}
            <path
              d="M40,54 C 130,44 260,44 360,50"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M50,86 C 150,92 260,92 350,86"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Left frayed edge */}
            <path d="M6,68 L-4,72 L2,60 Z" fill="oklch(0.68 0.27 350)" />
            <path d="M8,80 L-2,84 L4,78 Z" fill="oklch(0.68 0.27 350)" />
            {/* Right frayed edge */}
            <path d="M394,66 L406,62 L400,74 Z" fill="oklch(0.68 0.27 350)" />
            <path d="M392,80 L404,84 L398,76 Z" fill="oklch(0.68 0.27 350)" />
          </svg>
          <p
            className="relative block px-8 py-5 text-center text-[19px] leading-[1.15] text-white"
            style={{
              fontFamily: "'Caveat', cursive",
              fontWeight: 700,
              textShadow: "0 2px 3px rgba(0,0,0,0.3)",
            }}
          >
            A felicidade cabe em
            <br />
            cada colher!
          </p>
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
        <div className="relative mt-6 flex flex-col items-center">

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
