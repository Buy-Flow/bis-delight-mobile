import { useEffect, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { BRAND } from "@/data/menu";

export function FloatingActions() {
  const wa = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent("Olá! Vim pelo cardápio digital 🍦")}`;
  const [showMenuBtn, setShowMenuBtn] = useState(true);

  useEffect(() => {
    const el = document.getElementById("menu-section");
    if (!el) {
      setShowMenuBtn(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        // Esconde quando o cardápio está visível na tela
        const visible = entries.some((e) => e.isIntersecting);
        setShowMenuBtn(!visible);
      },
      { root: null, threshold: 0, rootMargin: "-10% 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scrollToMenu = () => {
    const el = document.getElementById("menu-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const bottomStyle = { bottom: "calc(env(safe-area-inset-bottom) + 4.75rem)" } as const;

  return (
    <>
      {/* WhatsApp — à esquerda, logo acima do menu inferior */}
      <div className="fixed left-4 z-[60] md:bottom-4" style={bottomStyle}>
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          aria-label="Falar no WhatsApp"
          className="grid h-10 w-10 place-items-center rounded-full bg-[#25D366] text-white shadow-2xl touch-manipulation [-webkit-tap-highlight-color:transparent] transition-transform duration-100 ease-out active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M20.5 3.5A11 11 0 0 0 3.6 17.2L2 22l4.9-1.6a11 11 0 0 0 5.3 1.4h.1a11 11 0 0 0 8.2-18.3zM12.3 19.9a9 9 0 0 1-4.6-1.3l-.3-.2-2.9.9.9-2.8-.2-.3a9 9 0 1 1 16.8-4.5 9 9 0 0 1-9.7 8.2zm5.2-6.7c-.3-.1-1.7-.8-1.9-.9s-.4-.1-.6.2-.7.9-.8 1-.3.2-.6 0a7.4 7.4 0 0 1-3.7-3.2c-.3-.5.3-.5.8-1.5.1-.2 0-.3 0-.5s-.6-1.5-.9-2c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-1 2.2c0 1.3 1 2.6 1.1 2.8s2 3.1 4.8 4.3a15.8 15.8 0 0 0 1.6.6c.7.2 1.3.2 1.8.1s1.7-.7 2-1.4a1.7 1.7 0 0 0 .1-1.4c-.1-.2-.3-.2-.6-.3z" />
          </svg>
        </a>
      </div>

      {/* Ver Cardápio — à direita com rótulo, some quando cardápio está em tela */}
      <div
        className={`fixed right-4 z-[60] md:bottom-4 transition-all duration-300 ${
          showMenuBtn ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
        style={bottomStyle}
      >
        <button
          type="button"
          onClick={scrollToMenu}
          aria-label="Ver cardápio"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-neon-pink pl-2.5 pr-3.5 text-white shadow-lg touch-manipulation [-webkit-tap-highlight-color:transparent] transition-transform duration-100 ease-out active:scale-95"
        >
          <UtensilsCrossed className="h-4 w-4" />
          <span className="text-[11px] font-black uppercase tracking-wide">Cardápio</span>
        </button>
      </div>
    </>
  );
}

