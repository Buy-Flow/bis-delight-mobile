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

      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-16 text-center">
        {/* "Peça seu" handwritten */}
        <div
          className="mb-0 text-[30px] leading-none text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
          style={{ fontFamily: "'Caveat Brush', cursive" }}
        >
          Peça seu
        </div>

        {/* Big yellow headline — chunky rounded display */}
        <h1
          className="mt-1 text-[52px] uppercase leading-[0.9] tracking-[0.005em] text-neon-yellow"
          style={{
            fontFamily: "'Bowlby One', 'Fredoka', sans-serif",
            textShadow:
              "0 3px 0 rgba(90,55,5,0.55), 0 6px 0 rgba(60,35,0,0.35), 0 10px 24px rgba(255,215,60,0.35), 0 0 28px rgba(255,215,60,0.25)",
          }}
        >
          Sorvete
          <br />
          Favorito
        </h1>

        {/* Pink handwritten pill */}
        <div className="relative mt-5">
          <span
            className="inline-block -rotate-[3deg] rounded-full bg-neon-pink px-5 py-2 text-[18px] leading-none text-white shadow-[0_8px_18px_-4px_rgba(236,64,122,0.7)]"
            style={{ fontFamily: "'Kalam', cursive", fontWeight: 700 }}
          >
            A felicidade cabe em cada colher!
          </span>
        </div>

        {/* Subtitle */}
        <p
          className="mt-5 text-[14px] leading-snug text-white/85"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Açaí, sorvetes, milk shakes
          <br />
          e muito mais para deixar
          <br />
          seu dia{" "}
          <span className="font-bold text-neon-pink">mais feliz!</span>
        </p>

        {/* WhatsApp pill button */}
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-neon-yellow px-5 py-3 text-[#2a1500] shadow-[0_10px_24px_-6px_rgba(255,215,60,0.55),inset_0_2px_0_rgba(255,255,255,0.55)] active:scale-[.97] transition"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#25D366] text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M20.5 3.5A11 11 0 0 0 3.6 17.2L2 22l4.9-1.6a11 11 0 0 0 5.3 1.4h.1a11 11 0 0 0 8.2-18.3zM12.3 19.9a9 9 0 0 1-4.6-1.3l-.3-.2-2.9.9.9-2.8-.2-.3a9 9 0 1 1 16.8-4.5 9 9 0 0 1-9.7 8.2zm5.2-6.7c-.3-.1-1.7-.8-1.9-.9s-.4-.1-.6.2-.7.9-.8 1-.3.2-.6 0a7.4 7.4 0 0 1-3.7-3.2c-.3-.5.3-.5.8-1.5.1-.2 0-.3 0-.5s-.6-1.5-.9-2c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-1 2.2c0 1.3 1 2.6 1.1 2.8s2 3.1 4.8 4.3a15.8 15.8 0 0 0 1.6.6c.7.2 1.3.2 1.8.1s1.7-.7 2-1.4a1.7 1.7 0 0 0 .1-1.4c-.1-.2-.3-.2-.6-.3z" />
            </svg>
          </span>
          <span
            className="flex flex-col items-start leading-[1.05]"
            style={{ fontFamily: "'Bowlby One', sans-serif" }}
          >
            <span className="text-[14px] uppercase tracking-wide">
              Pedir agora
            </span>
            <span
              className="text-[9px] font-bold tracking-[0.16em] text-[#2a1500]/70"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              PELO WHATSAPP
            </span>
          </span>
        </a>

        {/* Caption */}
        <button
          onClick={onScrollMenu}
          className="mt-4 text-[20px] leading-none text-white/90"
          style={{ fontFamily: "'Caveat Brush', cursive" }}
        >
          Rápido, prático e{" "}
          <span className="text-neon-pink underline decoration-neon-pink/70 decoration-2 underline-offset-2">
            delicioso!
          </span>
        </button>

        {/* Space for side illustrations */}
        <div className="h-40" />
      </div>
    </section>
  );
}
