import { MapPin, Navigation, MessageCircle, Instagram, Church, Phone, Bike, ShoppingBag } from "lucide-react";
import { BRAND } from "@/data/menu";
import { useSiteSettings, DEFAULT_HOURS, type WeekDay, type DayHours } from "@/lib/menu-data";
import { useEffect, useState } from "react";
import { AdminEditButton } from "./AdminEditButton";
import { formatPhone } from "@/lib/phone";


const DAY_ORDER: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL: Record<WeekDay, string> = {
  mon: "SEG", tue: "TER", wed: "QUA", thu: "QUI", fri: "SEX", sat: "SÁB", sun: "DOM",
};

function jsWeekdayToKey(d: number): WeekDay {
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as WeekDay[])[d];
}



export function isOpenNow(hours: DayHours[], override: "auto" | "open" | "closed") {
  if (override === "open") return true;
  if (override === "closed") return false;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const todayKey = jsWeekdayToKey(now.getDay());
  const yestKey = jsWeekdayToKey((now.getDay() + 6) % 7);

  const check = (day: DayHours | undefined, curMins: number) => {
    if (!day || day.closed) return false;
    const [oh, om] = day.open.split(":").map(Number);
    const [ch, cm] = day.close.split(":").map(Number);
    const openMin = oh * 60 + om;
    let closeMin = ch * 60 + cm;
    if (closeMin <= openMin) closeMin += 24 * 60;
    let cur = curMins;
    if (cur < openMin) cur += 24 * 60;
    return cur >= openMin && cur < closeMin;
  };

  if (check(hours.find((h) => h.day === todayKey), mins)) return true;
  if (check(hours.find((h) => h.day === yestKey), mins + 24 * 60)) return true;
  return false;
}

function toEmbedUrl(url: string): string {
  if (!url) return url;
  if (/\/maps\/embed/.test(url) || /output=embed/.test(url)) return url;
  const coord = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coord) {
    const lat = coord[1];
    const lng = coord[2];
    return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
}

function socialUrl(value: string | undefined | null, network: "instagram"): string {
  if (!value) return "";
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(/^\/+/, "");
  return `https://instagram.com/${handle}`;
}

export function LocationSection() {
  const { data: settings } = useSiteSettings();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const name = settings?.name || BRAND.name;
  const address = settings?.address || BRAND.address;
  const city = settings?.city || BRAND.city;
  const whatsapp = settings?.whatsapp || BRAND.whatsapp;
  const mapsUrl = settings?.mapsUrl || BRAND.mapsUrl;
  const rawMapEmbed = settings?.mapEmbed || BRAND.mapEmbed;
  const mapEmbed = toEmbedUrl(rawMapEmbed);
  const instagram = socialUrl(settings?.instagram, "instagram");
  const hours = settings?.hoursJson?.length ? settings.hoursJson : DEFAULT_HOURS;
  const override = settings?.openOverride ?? "auto";

  const open = mounted ? isOpenNow(hours, override) : false;
  const todayKey = mounted ? jsWeekdayToKey(new Date().getDay()) : "mon";
  const todayHours = hours.find((h) => h.day === todayKey);
  const todayLabel =
    todayHours && !todayHours.closed
      ? `${todayHours.open.slice(0, 5)} às ${todayHours.close.slice(0, 5)}`
      : "Fechado hoje";

  const waLink = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Olá! Quero fazer um pedido 🍧")}`;

  const openNativeMaps = () => {
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/(Macintosh)/.test(ua) && "ontouchend" in document);
    const query = encodeURIComponent(`${name} ${address} ${city}`);
    const url = isIOS
      ? `https://maps.apple.com/?q=${query}`
      : mapsUrl || `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section id="localizacao" className="relative px-5 pb-10 pt-16">
      <AdminEditButton tab="settings" label="Editar loja no painel" className="absolute right-5 top-4" />

      {/* Ambient decorations */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-4 top-6 grid grid-cols-4 gap-2 opacity-40">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="h-1 w-1 rounded-full bg-neon-pink" />
          ))}
        </div>
        <div
          className="absolute -right-12 -top-10 h-56 w-56 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.60 0.28 340 / 0.35), transparent 70%)" }}
        />
      </div>

      {/* Heading — script "Pertinho de você" with heart pin */}
      <div className="relative mb-7 text-center">
        <div className="relative inline-block">
          <div
            aria-hidden
            className="absolute -top-6 left-1/2 -translate-x-1/2 text-neon-pink drop-shadow-[0_0_10px_rgba(255,60,140,0.7)]"
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
              <path d="M12 2C7.6 2 4 5.4 4 9.6c0 5.6 8 12.4 8 12.4s8-6.8 8-12.4C20 5.4 16.4 2 12 2zm0 10.8a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
            </svg>
          </div>
          <h2
            className="text-white glow-yellow-text"
            style={{
              fontFamily: "'Caveat', cursive",
              fontWeight: 700,
              fontSize: 52,
              lineHeight: 0.9,
              textShadow: "0 3px 12px rgba(0,0,0,0.5)",
            }}
          >
            Pertinho
          </h2>
          <div
            className="-mt-2 text-neon-yellow"
            style={{
              fontFamily: "'Caveat', cursive",
              fontWeight: 700,
              fontSize: 42,
              lineHeight: 0.9,
              transform: "rotate(-3deg)",
              textShadow: "0 3px 12px rgba(0,0,0,0.5)",
            }}
          >
            de você
          </div>
        </div>
      </div>

      {/* Address card */}
      <div className="mb-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-neon-pink/20 ring-1 ring-neon-pink/40">
            <MapPin className="h-5 w-5 text-neon-pink" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-black leading-tight text-white">{address}</div>
            <div className="text-[12px] text-white/60">{city}</div>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
            <Church className="h-4 w-4 text-neon-yellow" strokeWidth={2.25} />
          </div>
          <p className="pt-1 text-[12px] leading-snug text-white/70">
            Esquina com a JK,
            <br />
            próximo à Igreja Matriz
          </p>
        </div>
      </div>

      {/* Map preview card — modelo claro com pills flutuantes */}
      <button
        type="button"
        onClick={openNativeMaps}
        aria-label="Abrir mapa"
        className="mb-5 block w-full overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_20px_60px_-20px_rgba(180,60,220,0.5)] active:scale-[0.99] transition"
      >
        <div className="relative h-[210px]">
          <iframe
            title={`Localização ${name}`}
            src={mapEmbed}
            className="pointer-events-none h-full w-full"
            style={{ border: 0 }}
            loading="lazy"
          />

          {/* Pill: Aberto/Fechado (top-left) */}
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white shadow-[0_6px_18px_-6px_rgba(0,0,0,0.35)]"
            style={{
              background: open
                ? "linear-gradient(135deg, oklch(0.72 0.19 155), oklch(0.58 0.18 155))"
                : "linear-gradient(135deg, oklch(0.68 0.22 25), oklch(0.55 0.22 25))",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest">
              {open ? "Aberto" : "Fechado"}
            </span>
          </div>

          {/* Pills lado direito: Delivery + Retirada */}
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white shadow-[0_6px_18px_-6px_rgba(0,0,0,0.35)]"
              style={{ background: "linear-gradient(135deg, oklch(0.58 0.14 210), oklch(0.42 0.12 220))" }}
            >
              <Bike className="h-3.5 w-3.5" strokeWidth={2.75} />
              <span className="text-[11px] font-black uppercase tracking-widest">Delivery</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white shadow-[0_6px_18px_-6px_rgba(0,0,0,0.35)]"
              style={{ background: "linear-gradient(135deg, oklch(0.60 0.16 200), oklch(0.44 0.14 215))" }}
            >
              <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2.75} />
              <span className="text-[11px] font-black uppercase tracking-widest">Retirada</span>
            </div>
          </div>

          {/* Marker rosa pulsante no centro */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div aria-hidden className="absolute inset-0 -m-6 animate-ping rounded-full bg-neon-pink/40" />
              <div aria-hidden className="absolute inset-0 -m-4 rounded-full bg-neon-pink/30 blur-md" />
              <div
                className="relative grid h-12 w-12 place-items-center rounded-full bg-neon-pink text-white ring-4 ring-neon-pink/40"
                style={{ boxShadow: "0 10px 30px oklch(0.65 0.28 340 / 0.7)" }}
              >
                <MapPin className="h-5 w-5" strokeWidth={2.75} />
              </div>
            </div>
          </div>
        </div>
      </button>


      {/* Horário header with rota button */}
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-neon-pink drop-shadow-[0_0_8px_rgba(255,60,140,0.7)]">✦</span>
          <span className="text-[11px] font-black uppercase tracking-[.3em] text-white">Horário</span>
        </div>
        <button
          type="button"
          onClick={openNativeMaps}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-white backdrop-blur active:scale-95 transition"
        >
          <Navigation className="h-3.5 w-3.5" strokeWidth={2.5} />
          ROTA
        </button>
      </div>

      {/* Days grid */}
      <div className="mb-5 grid grid-cols-7 gap-1.5">
        {DAY_ORDER.map((key) => {
          const d = hours.find((h) => h.day === key);
          const isToday = mounted && key === todayKey;
          const closed = !d || d.closed;
          return (
            <div
              key={key}
              className={`relative flex flex-col items-center rounded-xl px-1 py-2 text-center ${
                isToday
                  ? "text-white shadow-[0_8px_20px_-8px_rgba(255,60,140,0.7)]"
                  : "border border-white/10 bg-white/[0.04] text-white/85"
              }`}
              style={
                isToday
                  ? {
                      background:
                        "linear-gradient(160deg, oklch(0.60 0.28 340) 0%, oklch(0.45 0.24 310) 100%)",
                    }
                  : undefined
              }
            >
              <div className={`text-[9px] font-black uppercase tracking-[.15em] ${isToday ? "text-white" : "text-white/60"}`}>
                {DAY_LABEL[key]}
              </div>
              {closed ? (
                <div className={`mt-1 text-[13px] font-black ${isToday ? "text-white" : "text-white/40"}`}>—</div>
              ) : (
                <>
                  <div className="mt-1 text-[12px] font-black leading-tight">{d!.open.slice(0, 5)}</div>
                  <div className="text-[12px] font-black leading-tight">{d!.close.slice(0, 5)}</div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Big WhatsApp CTA */}
      <a
        href={waLink}
        target="_blank"
        rel="noreferrer"
        className="relative mb-4 flex w-full items-center gap-3 overflow-hidden rounded-[28px] px-5 py-4 font-black text-white active:scale-[0.98] transition"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.68 0.26 350) 0%, oklch(0.55 0.28 340) 55%, oklch(0.45 0.24 315) 100%)",
          boxShadow:
            "0 20px 45px -15px oklch(0.60 0.28 340 / 0.75), inset 0 1px 0 rgba(255,255,255,0.25)",
        }}
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/25 ring-1 ring-white/30">
          <MessageCircle className="h-5 w-5" strokeWidth={2.5} />
        </span>
        <span className="flex-1 text-center text-[17px] tracking-wide">Pedir no WhatsApp</span>
        <span className="text-white/85">›</span>
      </a>

      {/* Phone row */}
      <div className="flex items-center justify-between px-1">
        <a
          href={`tel:+${whatsapp}`}
          className="flex items-center gap-2 text-white/85 active:scale-95 transition"
        >
          <Phone className="h-4 w-4 text-neon-pink" strokeWidth={2.5} />
          <span className="text-[15px] font-black">{formatPhone(whatsapp)}</span>
        </a>

        {instagram && (
          <a
            href={instagram}
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="grid h-10 w-10 place-items-center rounded-2xl text-white shadow-[0_10px_25px_-10px_rgba(255,60,140,0.7)] active:scale-95 transition"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.65 0.22 60) 0%, oklch(0.58 0.26 350) 50%, oklch(0.50 0.24 300) 100%)",
            }}
          >
            <Instagram className="h-5 w-5" strokeWidth={2.5} />
          </a>
        )}
      </div>

    </section>
  );
}
