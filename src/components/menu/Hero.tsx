import { BRAND } from "@/data/menu";

import heroBgLeft from "@/assets/hero-bg-left.png.asset.json";
import heroBgRight from "@/assets/hero-bg-right.png.asset.json";
import brushHappiness from "@/assets/brush-happiness.png.asset.json";


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

      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-12 text-center">
        {/* "Peça seu" — sans-serif, subtly handwritten italic */}
        <div
          className="mb-1 text-[22px] italic leading-none text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}
        >
          Peça seu
        </div>

        {/* Big yellow headline — condensed ultrabold uppercase */}
        <h1
          className="mt-1 text-[64px] uppercase leading-[0.85] tracking-[0.01em] text-neon-yellow"
          style={{
            fontFamily: "'Barlow Condensed', 'Anton', sans-serif",
            fontWeight: 900,
            textShadow:
              "0 3px 0 rgba(90,55,5,0.55), 0 6px 0 rgba(60,35,0,0.35), 0 10px 24px rgba(255,215,60,0.35), 0 0 28px rgba(255,215,60,0.25)",
          }}
        >
          Sorvete
          <br />
          Favorito
        </h1>

        {/* Torn paper / brush stroke pink banner */}
        <div className="relative mt-5 w-full max-w-[320px] -rotate-[2deg]">
          <svg
            viewBox="0 0 320 64"
            className="absolute inset-0 h-full w-full drop-shadow-[0_10px_18px_-6px_rgba(236,64,122,0.7)]"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M6 18 L20 10 L46 16 L78 8 L112 14 L150 6 L188 14 L224 8 L262 16 L292 10 L312 20 L316 34 L308 46 L286 54 L252 48 L216 56 L180 50 L142 58 L108 50 L74 56 L42 48 L18 54 L8 44 L4 30 Z"
              fill="oklch(0.72 0.26 350)"
            />
          </svg>
          <span
            className="relative block px-6 py-3 text-[19px] leading-tight text-white"
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

        {/* Bottom row: hand-drawn arrow + final caption */}
        <div className="relative mt-5 flex items-end justify-center">
          <svg
            viewBox="0 0 70 50"
            className="absolute -left-12 -top-2 h-12 w-16"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 44 C 18 30, 32 18, 58 10" />
            <path d="M50 6 L60 10 L54 18" />
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
