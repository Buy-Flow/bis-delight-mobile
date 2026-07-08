import { MapPin, Clock, Navigation, MessageCircle, Instagram, Facebook, Bike, Store, Sparkles } from "lucide-react";
import { BRAND } from "@/data/menu";
import { useSiteSettings, DEFAULT_HOURS, type WeekDay, type DayHours } from "@/lib/menu-data";
import { useEffect, useState } from "react";

const DAY_LABEL: Record<WeekDay, string> = {
  mon: "Seg", tue: "Ter", wed: "Qua", thu: "Qui", fri: "Sex", sat: "Sáb", sun: "Dom",
};
const DAY_ORDER: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function jsWeekdayToKey(d: number): WeekDay {
  // JS: 0=Sun..6=Sat
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as WeekDay[])[d];
}

function isOpenNow(hours: DayHours[], override: "auto" | "open" | "closed") {
  if (override === "open") return true;
  if (override === "closed") return false;
  const now = new Date();
  const key = jsWeekdayToKey(now.getDay());
  const today = hours.find((h) => h.day === key);
  if (!today || today.closed) return false;
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  const openMins = oh * 60 + om;
  const closeMins = ch * 60 + cm;
  return mins >= openMins && mins <= closeMins;
}

export function LocationSection() {
  const { data: settings } = useSiteSettings();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const name = settings?.name || BRAND.name;
  const tagline = settings?.tagline || BRAND.tagline;
  const address = settings?.address || BRAND.address;
  const city = settings?.city || BRAND.city;
  const whatsapp = settings?.whatsapp || BRAND.whatsapp;
  const whatsappDisplay = settings?.whatsappDisplay || BRAND.whatsappDisplay;
  const mapsUrl = settings?.mapsUrl || BRAND.mapsUrl;
  const mapEmbed = settings?.mapEmbed || BRAND.mapEmbed;
  const logo = settings?.logo || BRAND.logo;
  const instagram = settings?.instagram || "";
  const facebook = settings?.facebook || "";
  const tiktok = settings?.tiktok || "";
  const acceptsDelivery = settings?.acceptsDelivery ?? true;
  const acceptsPickup = settings?.acceptsPickup ?? true;
  const hours = settings?.hoursJson?.length ? settings.hoursJson : DEFAULT_HOURS;
  const override = settings?.openOverride ?? "auto";

  const open = mounted ? isOpenNow(hours, override) : false;
  const todayKey = mounted ? jsWeekdayToKey(new Date().getDay()) : "mon";

  const waLink = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Olá! Quero fazer um pedido 🍧")}`;

  return (
    <section id="localizacao" className="relative px-4 py-10">
      {/* Header */}
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-neon-pink/40 bg-neon-pink/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-neon-pink">
            <Sparkles className="h-3 w-3" /> Vem pra loja
          </div>
          <h2 className="font-display text-3xl font-black leading-none text-white">
            Cola com a<br />
            <span className="bg-gradient-to-r from-neon-pink via-fuchsia-400 to-neon-cyan bg-clip-text text-transparent">
              gente 🍧
            </span>
          </h2>
        </div>
        <div
          aria-hidden
          className="relative h-16 w-16 shrink-0 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10 backdrop-blur"
          style={{ boxShadow: "0 8px 32px oklch(0.55 0.28 320 / 0.35)" }}
        >
          <img src={logo} alt="" className="h-full w-full object-contain" />
        </div>
      </div>

      {/* Main card */}
      <div
        className="relative overflow-hidden rounded-[28px]"
        style={{
          background: "linear-gradient(180deg, oklch(0.14 0.10 305 / 0.85) 0%, oklch(0.08 0.06 305 / 0.95) 100%)",
          boxShadow:
            "0 20px 60px -20px oklch(0.55 0.28 320 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.08)",
        }}
      >
        {/* Animated gradient border */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[28px] p-[1.5px]"
          style={{
            background:
              "conic-gradient(from 180deg at 50% 50%, oklch(0.75 0.25 340) 0%, oklch(0.85 0.20 190) 25%, oklch(0.75 0.25 340) 50%, oklch(0.85 0.20 190) 75%, oklch(0.75 0.25 340) 100%)",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            opacity: 0.35,
          }}
        />

        {/* Map with floating status */}
        <div className="relative h-56 overflow-hidden">
          <iframe
            title={`Localização ${name}`}
            src={mapEmbed}
            className="h-full w-full grayscale-[.15]"
            style={{ border: 0, filter: "hue-rotate(-10deg) saturate(1.1)" }}
            loading="lazy"
          />
          {/* Bottom fade into card */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, oklch(0.08 0.06 305 / 0.75) 60%, oklch(0.08 0.06 305) 100%)",
            }}
          />
          {/* Open/closed badge */}
          <div className="absolute left-3 top-3">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest backdrop-blur-md ${
                open
                  ? "border border-emerald-300/50 bg-emerald-400/15 text-emerald-200"
                  : "border border-rose-300/50 bg-rose-400/15 text-rose-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  open ? "bg-emerald-300 animate-pulse" : "bg-rose-300"
                }`}
              />
              {open ? "Aberto agora" : "Fechado"}
            </div>
          </div>
          {/* Modes */}
          <div className="absolute right-3 top-3 flex gap-1.5">
            {acceptsDelivery && (
              <span className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/50 bg-neon-cyan/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neon-cyan backdrop-blur">
                <Bike className="h-3 w-3" /> Delivery
              </span>
            )}
            {acceptsPickup && (
              <span className="inline-flex items-center gap-1 rounded-full border border-neon-pink/50 bg-neon-pink/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neon-pink backdrop-blur">
                <Store className="h-3 w-3" /> Retirada
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="relative space-y-4 p-5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.22em] text-white/40">Onde estamos</div>
            <div className="mt-1 flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neon-pink/15 text-neon-pink ring-1 ring-neon-pink/40">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold leading-tight text-white">{address}</div>
                <div className="text-[12px] text-white/55">{city}</div>
              </div>
            </div>
          </div>

          {/* Weekly hours */}
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neon-cyan/15 text-neon-cyan ring-1 ring-neon-cyan/40">
                <Clock className="h-4 w-4" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-[.22em] text-white/40">Horário</div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {DAY_ORDER.map((d) => {
                const h = hours.find((x) => x.day === d);
                const isToday = mounted && d === todayKey;
                return (
                  <div
                    key={d}
                    className={`rounded-xl px-1 py-2 text-center transition ${
                      isToday
                        ? "bg-gradient-to-b from-neon-pink/25 to-neon-cyan/15 text-white ring-1 ring-neon-pink/50"
                        : "bg-white/[.03] text-white/60 ring-1 ring-white/5"
                    }`}
                  >
                    <div className="text-[9px] font-black uppercase tracking-wider">{DAY_LABEL[d]}</div>
                    <div className="mt-0.5 text-[10px] font-bold leading-tight">
                      {h?.closed ? "—" : h ? `${h.open.slice(0, 5)}` : "—"}
                    </div>
                    <div className="text-[9px] leading-tight text-white/45">
                      {h?.closed ? "" : h ? h.close.slice(0, 5) : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTAs */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl border border-neon-cyan/60 bg-neon-cyan/10 px-3 py-3.5 text-sm font-black text-neon-cyan transition active:scale-[.97]"
            >
              <Navigation className="h-4 w-4" />
              Abrir no Maps
            </a>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-neon-pink to-fuchsia-500 px-3 py-3.5 text-sm font-black text-white shadow-lg shadow-neon-pink/40 transition active:scale-[.97]"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </div>

          {/* Contact + socials */}
          <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-4">
            <a
              href={`tel:+${whatsapp}`}
              className="text-[12px] font-bold text-white/70 transition hover:text-white"
            >
              {whatsappDisplay}
            </a>
            <div className="flex items-center gap-2">
              {instagram && (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 transition hover:bg-neon-pink/15 hover:text-neon-pink hover:ring-neon-pink/40"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {facebook && (
                <a
                  href={facebook}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 transition hover:bg-neon-cyan/15 hover:text-neon-cyan hover:ring-neon-cyan/40"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
              {tiktok && (
                <a
                  href={tiktok}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="TikTok"
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white hover:ring-white/30"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M19.6 6.3a5.7 5.7 0 0 1-3.4-1.2 5.7 5.7 0 0 1-2.2-3.6h-3v14a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.9a5.7 5.7 0 1 0 4.8 5.6V9.2a8.7 8.7 0 0 0 5.6 2V6.3z" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer signature */}
      <div className="mt-6 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[.22em] text-white/35">
          {name} · {tagline}
        </div>
        <div className="mt-1 text-[10px] text-white/25">
          feito com 💜 em {city.split(" - ")[0] || city}
        </div>
      </div>
    </section>
  );
}
