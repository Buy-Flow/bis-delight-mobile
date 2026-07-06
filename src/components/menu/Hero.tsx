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
          <span className="inline-block -rotate-[4deg]">Sorvete</span>
          <br />
          <span className="inline-block rotate-[3deg]">Favorito</span>
        </h1>

        {/* Elegant ribbon banner — twin ribbon tails + soft gradient */}
        <div className="relative mt-6 w-full max-w-[290px] -rotate-[1.5deg]">
          <svg
            viewBox="0 0 400 110"
            className="absolute inset-0 h-full w-full drop-shadow-[0_12px_20px_-8px_rgba(236,64,122,0.65)]"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="ribbonGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="oklch(0.78 0.24 350)" />
                <stop offset="50%" stopColor="oklch(0.68 0.28 350)" />
                <stop offset="100%" stopColor="oklch(0.58 0.26 350)" />
              </linearGradient>
            </defs>
            {/* Left tail */}
            <path d="M0,78 L22,58 L44,72 L28,88 Z" fill="oklch(0.48 0.22 350)" />
            {/* Right tail */}
            <path d="M400,78 L378,58 L356,72 L372,88 Z" fill="oklch(0.48 0.22 350)" />
            {/* Main ribbon body */}
            <path
              d="M20,30 Q200,10 380,30 L380,80 Q200,100 20,80 Z"
              fill="url(#ribbonGrad)"
            />
            {/* Inner highlight stitch */}
            <path
              d="M32,38 Q200,22 368,38"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1"
              fill="none"
              strokeDasharray="3 4"
            />
          </svg>
          <span
            className="relative block px-8 py-4 text-[16px] leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
            style={{ fontFamily: "'Caveat', cursive", fontWeight: 700 }}
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

        {/* WhatsApp CTA — sculpted 3D pill with gradient + glow ring */}
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="group relative mt-7 inline-flex items-center gap-3 rounded-full px-7 py-3.5 text-black active:scale-[.97] transition"
          style={{
            background:
              "linear-gradient(180deg, #FFF089 0%, #FFDA3D 45%, #F0B400 100%)",
            boxShadow:
              "0 0 0 3px rgba(255,215,60,0.18), 0 14px 28px -8px rgba(255,180,0,0.55), inset 0 2px 0 rgba(255,255,255,0.75), inset 0 -3px 0 rgba(160,90,0,0.35)",
          }}
        >
          {/* Glossy top highlight */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 top-1 h-2 rounded-full opacity-70"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0))",
            }}
          />
          <span
            className="relative grid h-9 w-9 place-items-center rounded-full"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, #2ee56b 0%, #0aa84a 70%, #067a35 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.5), 0 3px 6px rgba(0,0,0,0.35)",
            }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.5 3.5A11 11 0 0 0 3.6 17.2L2 22l4.9-1.6a11 11 0 0 0 5.3 1.4h.1a11 11 0 0 0 8.2-18.3z" />
              <path d="M8.2 7.6a1 1 0 0 1 .9-.5h.6c.2 0 .4 0 .6.4.3.5.9 2 .9 2.1s.1.3 0 .5c-.5 1-1.1 1-.8 1.5a7.4 7.4 0 0 0 3.7 3.2c.3.2.5.1.6 0 .1-.1.6-.7.8-1s.4-.3.6-.2 1.6.8 1.9.9c.3.1.5.2.6.3a1.7 1.7 0 0 1-.1 1.4c-.3.7-1.5 1.3-2 1.4s-1.1.1-1.8-.1a15.8 15.8 0 0 1-1.6-.6c-2.8-1.2-4.6-4.1-4.8-4.3s-1.1-1.5-1.1-2.8a3 3 0 0 1 1-2.2z" />
            </svg>
          </span>
          <span className="relative flex flex-col items-start leading-[1]">
            <span
              className="text-[17px] uppercase tracking-wide"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 900 }}
            >
              Pedir agora
            </span>
            <span
              className="mt-1 text-[9.5px] tracking-[0.24em] text-black/70"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600 }}
            >
              PELO WHATSAPP
            </span>
          </span>
        </a>

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
