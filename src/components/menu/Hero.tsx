import { BRAND } from "@/data/menu";

import heroBgLeft from "@/assets/hero-bg-left.png.asset.json";
import heroBgRight from "@/assets/hero-bg-right.png.asset.json";

export function Hero({ onScrollMenu }: { onScrollMenu: () => void }) {
  const waLink = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(
    "Olá! Quero fazer um pedido na Quero Bis 🍧",
  )}`;

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

        {/* Big yellow headline — flat, no 3D shadow */}
        <h1
          className="mt-1 text-[60px] uppercase leading-[0.88] tracking-[0.01em] text-neon-yellow"
          style={{
            fontFamily: "'Barlow Condensed', 'Anton', sans-serif",
            fontWeight: 900,
          }}
        >
          Sorvete
          <br />
          Favorito
        </h1>

        {/* Pink brush-stroke banner */}
        <div className="relative mt-5 w-full max-w-[300px] -rotate-[2deg]">
          <svg
            viewBox="0 0 400 100"
            className="absolute inset-0 h-full w-full drop-shadow-[0_10px_18px_-6px_rgba(236,64,122,0.6)]"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M10,52 C 20,20 60,14 120,18 C 200,24 260,10 340,22 C 380,28 396,42 388,64 C 378,86 320,90 240,86 C 160,82 90,94 40,86 C 10,80 -2,72 10,52 Z"
              fill="oklch(0.72 0.26 350)"
            />
          </svg>
          <span
            className="relative block px-6 py-3 text-[18px] leading-tight text-white"
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

        {/* WhatsApp pill button */}
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-3 rounded-full bg-neon-yellow px-6 py-3 text-black shadow-[0_10px_24px_-6px_rgba(255,215,60,0.55),inset_0_2px_0_rgba(255,255,255,0.55)] active:scale-[.97] transition"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.5 3.5A11 11 0 0 0 3.6 17.2L2 22l4.9-1.6a11 11 0 0 0 5.3 1.4h.1a11 11 0 0 0 8.2-18.3z" />
            <path d="M8.2 7.6a1 1 0 0 1 .9-.5h.6c.2 0 .4 0 .6.4.3.5.9 2 .9 2.1s.1.3 0 .5c-.5 1-1.1 1-.8 1.5a7.4 7.4 0 0 0 3.7 3.2c.3.2.5.1.6 0 .1-.1.6-.7.8-1s.4-.3.6-.2 1.6.8 1.9.9c.3.1.5.2.6.3a1.7 1.7 0 0 1-.1 1.4c-.3.7-1.5 1.3-2 1.4s-1.1.1-1.8-.1a15.8 15.8 0 0 1-1.6-.6c-2.8-1.2-4.6-4.1-4.8-4.3s-1.1-1.5-1.1-2.8a3 3 0 0 1 1-2.2z" />
          </svg>
          <span className="flex flex-col items-start leading-[1]">
            <span
              className="text-[17px] uppercase tracking-wide"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 900 }}
            >
              Pedir agora
            </span>
            <span
              className="mt-0.5 text-[10px] tracking-[0.22em]"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}
            >
              PELO WHATSAPP
            </span>
          </span>
        </a>

        {/* Bottom row: hand-drawn arrow pointing UP from the left of the caption to the WhatsApp button */}
        <div className="relative mt-5 flex items-end justify-center">
          <svg
            viewBox="0 0 60 70"
            className="absolute -left-14 -top-16 h-20 w-14"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* Curve from bottom-left up to top-right (toward WhatsApp button above) */}
            <path d="M8 64 C 6 44, 14 24, 44 10" />
            {/* Arrow head pointing up-right */}
            <path d="M36 6 L46 8 L44 18" />
          </svg>
          <button
            onClick={onScrollMenu}
            className="text-[15px] leading-none text-white"
            style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}
          >
            Rápido, prático e{" "}
            <span
              className="ml-0.5 -rotate-[6deg] inline-block text-neon-pink"
              style={{ fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: "22px" }}
            >
              delicioso!
            </span>
          </button>
        </div>

        {/* Space for side illustrations */}
        <div className="h-32" />
      </div>

    </section>
  );
}
