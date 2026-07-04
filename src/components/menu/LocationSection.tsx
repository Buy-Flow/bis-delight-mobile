import { MapPin, Clock, Navigation, MessageCircle } from "lucide-react";
import { BRAND } from "@/data/menu";

export function LocationSection() {
  const waLink = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent("Olá! Quero fazer um pedido 🍧")}`;
  return (
    <section id="localizacao" className="px-4 py-8">
      <div className="mb-4">
        <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neon-cyan">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-cyan" />
          Aberto agora
        </div>
        <h2 className="font-display text-2xl font-extrabold text-white">
          Vem tomar com a gente
        </h2>
        <p className="text-[13px] text-white/60">
          Passe na loja ou peça pelo delivery.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl card-acai">
        <div className="relative h-52 overflow-hidden">
          <iframe
            title="Localização Quero Bis"
            src={BRAND.mapEmbed}
            className="h-full w-full grayscale-[10%] contrast-[1.05]"
            style={{ border: 0, filter: "hue-rotate(220deg) saturate(1.2)" }}
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[oklch(0.18_0.11_305)]/70" />
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neon-pink/20 text-neon-pink ring-1 ring-neon-pink/40">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{BRAND.address}</div>
              <div className="text-[12px] text-white/60">{BRAND.city}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neon-cyan/20 text-neon-cyan ring-1 ring-neon-cyan/40">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{BRAND.hours}</div>
              <div className="text-[12px] text-white/60">Delivery e balcão</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href={BRAND.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neon-cyan/60 bg-neon-cyan/10 px-3 py-3 text-sm font-bold text-neon-cyan active:scale-[.98]"
            >
              <Navigation className="h-4 w-4" /> Abrir no Maps
            </a>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neon-pink px-3 py-3 text-sm font-bold text-white glow-pink active:scale-[.98]"
            >
              <MessageCircle className="h-4 w-4" /> Pedir no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
