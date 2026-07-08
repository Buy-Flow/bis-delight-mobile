import { MapPin, Navigation, MessageCircle, Instagram, Facebook, Phone, Bike, Store } from "lucide-react";
import { BRAND } from "@/data/menu";
import { useSiteSettings, DEFAULT_HOURS, type WeekDay, type DayHours } from "@/lib/menu-data";
import { useEffect, useState } from "react";

const DAY_LABEL: Record<WeekDay, string> = {
  mon: "SEG", tue: "TER", wed: "QUA", thu: "QUI", fri: "SEX", sat: "SÁB", sun: "DOM",
};
const DAY_ORDER: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function jsWeekdayToKey(d: number): WeekDay {
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
  return mins >= oh * 60 + om && mins <= ch * 60 + cm;
}

/**
 * Google Maps só permite iframe via /maps/embed. URLs regulares (maps/place/...) retornam
 * "conexão recusada" (X-Frame-Options: DENY). Convertemos extraindo lat/lng do formato
 * "@lat,lng,zoom" e usando o embed sem chave "?output=embed".
 */
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

function socialUrl(value: string | undefined | null, network: "instagram" | "facebook" | "tiktok"): string {
  if (!value) return "";
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(/^\/+/, "");
  switch (network) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "facebook":
      return `https://facebook.com/${handle}`;
    case "tiktok":
      return `https://tiktok.com/@${handle}`;
  }
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
  const rawMapEmbed = settings?.mapEmbed || BRAND.mapEmbed;
  const mapEmbed = toEmbedUrl(rawMapEmbed);

  const logo = settings?.logo || BRAND.logo;
  const instagram = socialUrl(settings?.instagram, "instagram");
  const facebook = socialUrl(settings?.facebook, "facebook");
  const tiktok = socialUrl(settings?.tiktok, "tiktok");

  const acceptsDelivery = settings?.acceptsDelivery ?? true;
  const acceptsPickup = settings?.acceptsPickup ?? true;
  const hours = settings?.hoursJson?.length ? settings.hoursJson : DEFAULT_HOURS;
  const override = settings?.openOverride ?? "auto";

  const open = mounted ? isOpenNow(hours, override) : false;
  const todayKey = mounted ? jsWeekdayToKey(new Date().getDay()) : "mon";
  const todayHours = hours.find((h) => h.day === todayKey);

  const waLink = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Olá! Quero fazer um pedido 🍧")}`;

  return (
    <section id="localizacao" className="relative px-4 py-12">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div
          className="absolute -left-20 top-10 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.65 0.28 340 / 0.35), transparent 70%)" }}
        />
        <div
          className="absolute -right-20 bottom-10 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.75 0.22 195 / 0.30), transparent 70%)" }}
        />
      </div>

      {/* Eyebrow */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <span className="text-[10px] font-black uppercase tracking-[.35em] text-white/50">Nos visite</span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      {/* Ticket-style card */}
      <div className="relative">
        {/* Notches */}
        <div className="pointer-events-none absolute left-1/2 top-[220px] z-20 -translate-x-1/2">
          <div className="flex items-center">
            <div className="h-5 w-5 rounded-full bg-[hsl(var(--background))]" style={{ boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.08)" }} />
          </div>
        </div>
        <div className="pointer-events-none absolute -left-4 top-[220px] z-20">
          <div className="h-5 w-5 rounded-full bg-[hsl(var(--background))]" />
        </div>
        <div className="pointer-events-none absolute -right-4 top-[220px] z-20">
          <div className="h-5 w-5 rounded-full bg-[hsl(var(--background))]" />
        </div>

        <div
          className="relative overflow-hidden rounded-[32px]"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.12 0.09 305 / 0.85) 0%, oklch(0.06 0.05 305 / 0.98) 100%)",
            boxShadow:
              "0 30px 80px -30px oklch(0.55 0.28 320 / 0.6), inset 0 1px 0 oklch(1 0 0 / 0.10)",
            border: "1px solid oklch(1 0 0 / 0.08)",
          }}
        >
          {/* MAP TOP */}
          <div className="relative h-[240px] overflow-hidden">
            <iframe
              title={`Localização ${name}`}
              src={mapEmbed}
              className="h-full w-full"
              style={{ border: 0, filter: "saturate(1.15) contrast(1.05)" }}
              loading="lazy"
            />
            {/* Vignette */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 80% at 50% 40%, transparent 40%, oklch(0.06 0.05 305 / 0.55) 100%)",
              }}
            />
            {/* Bottom fade */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
              style={{
                background:
                  "linear-gradient(180deg, transparent 0%, oklch(0.06 0.05 305 / 0.9) 100%)",
              }}
            />

            {/* Pin marker */}
            <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
                <div
                  aria-hidden
                  className="absolute inset-0 -m-4 animate-ping rounded-full bg-neon-pink/40"
                />
                <div
                  className="relative grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-neon-pink to-fuchsia-500 ring-4 ring-neon-pink/30"
                  style={{ boxShadow: "0 8px 24px oklch(0.65 0.28 340 / 0.6)" }}
                >
                  <img src={logo} alt="" className="h-6 w-6 object-contain" />
                </div>
              </div>
            </div>

            {/* Live status pill */}
            <div className="absolute left-4 top-4">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[.22em] backdrop-blur-md ${
                  open
                    ? "border border-emerald-300/50 bg-emerald-400/15 text-emerald-200"
                    : "border border-rose-300/50 bg-rose-400/15 text-rose-200"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-emerald-300 animate-pulse" : "bg-rose-300"}`} />
                {open ? "Aberto" : "Fechado"}
              </div>
            </div>

            {/* Modes */}
            <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5">
              {acceptsDelivery && (
                <span className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/50 bg-neon-cyan/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-neon-cyan backdrop-blur">
                  <Bike className="h-3 w-3" /> Delivery
                </span>
              )}
              {acceptsPickup && (
                <span className="inline-flex items-center gap-1 rounded-full border border-neon-pink/50 bg-neon-pink/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-neon-pink backdrop-blur">
                  <Store className="h-3 w-3" /> Retirada
                </span>
              )}
            </div>
          </div>

          {/* PERFORATED DIVIDER */}
          <div className="relative h-4">
            <div
              aria-hidden
              className="absolute inset-x-6 top-1/2 -translate-y-1/2 border-t border-dashed border-white/15"
            />
          </div>

          {/* INFO BOTTOM */}
          <div className="relative space-y-5 px-5 pb-6 pt-2">
            {/* Title row */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.28em] text-neon-pink/80">Endereço</div>
              <div className="mt-1 flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neon-pink" />
                <div>
                  <div className="text-[15px] font-black leading-tight text-white">{address}</div>
                  <div className="text-[12px] text-white/55">{city}</div>
                </div>
              </div>
            </div>

            {/* Horários semana */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-[.28em] text-neon-cyan">Horário</div>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Como chegar"
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70 transition hover:border-neon-cyan/50 hover:text-neon-cyan"
                >
                  <Navigation className="h-3 w-3" /> Rota
                </a>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_ORDER.map((d) => {
                  const h = hours.find((x) => x.day === d);
                  const isToday = mounted && d === todayKey;
                  const closed = !!h?.closed;
                  return (
                    <div
                      key={d}
                      className={`rounded-xl px-1 py-2 text-center transition ${
                        isToday
                          ? "bg-gradient-to-b from-neon-pink/30 to-neon-cyan/15 ring-1 ring-neon-pink/50"
                          : "bg-white/[.04] ring-1 ring-white/5"
                      }`}
                    >
                      <div
                        className={`text-[9px] font-black uppercase tracking-wider ${
                          isToday ? "text-white" : "text-white/55"
                        }`}
                      >
                        {DAY_LABEL[d]}
                      </div>
                      {closed ? (
                        <div className={`mt-1 text-[13px] font-black leading-none ${isToday ? "text-white/70" : "text-white/30"}`}>
                          —
                        </div>
                      ) : h ? (
                        <>
                          <div className={`mt-1 text-[10px] font-bold leading-tight ${isToday ? "text-white" : "text-white/70"}`}>
                            {h.open.slice(0, 5)}
                          </div>
                          <div className={`text-[10px] font-bold leading-tight ${isToday ? "text-white" : "text-white/55"}`}>
                            {h.close.slice(0, 5)}
                          </div>
                        </>
                      ) : (
                        <div className="mt-1 text-[13px] font-black leading-none text-white/30">—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>


            {/* Big WhatsApp CTA */}
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="group relative flex items-center justify-between overflow-hidden rounded-2xl px-5 py-4 font-black text-white transition active:scale-[.98]"
              style={{
                background: "linear-gradient(135deg, oklch(0.65 0.28 340) 0%, oklch(0.60 0.22 15) 100%)",
                boxShadow: "0 12px 32px -8px oklch(0.65 0.28 340 / 0.6)",
              }}
            >
              <span className="relative z-10 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 backdrop-blur">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span className="text-[15px]">Pedir no WhatsApp</span>
              </span>
              <span className="relative z-10 text-[11px] font-bold uppercase tracking-widest opacity-80">
                →
              </span>
              {/* Shimmer */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
            </a>

            {/* Contact + socials footer */}
            <div className="flex items-center justify-between gap-3 border-t border-dashed border-white/10 pt-4">
              <a
                href={`tel:+${whatsapp}`}
                className="inline-flex items-center gap-2 text-[12px] font-bold text-white/70 transition hover:text-white"
              >
                <Phone className="h-3.5 w-3.5" />
                {whatsappDisplay}
              </a>
              <div className="flex items-center gap-1.5">
                {instagram && (
                  <a
                    href={instagram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                    className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-white/70 ring-1 ring-white/10 transition hover:bg-neon-pink/15 hover:text-neon-pink hover:ring-neon-pink/40"
                  >
                    <Instagram className="h-3.5 w-3.5" />
                  </a>
                )}
                {facebook && (
                  <a
                    href={facebook}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Facebook"
                    className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-white/70 ring-1 ring-white/10 transition hover:bg-neon-cyan/15 hover:text-neon-cyan hover:ring-neon-cyan/40"
                  >
                    <Facebook className="h-3.5 w-3.5" />
                  </a>
                )}
                {tiktok && (
                  <a
                    href={tiktok}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="TikTok"
                    className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-white/70 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                      <path d="M19.6 6.3a5.7 5.7 0 0 1-3.4-1.2 5.7 5.7 0 0 1-2.2-3.6h-3v14a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.9a5.7 5.7 0 1 0 4.8 5.6V9.2a8.7 8.7 0 0 0 5.6 2V6.3z" />
                    </svg>
                  </a>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Tagline */}
      <div className="mt-5 text-center text-[10px] font-bold uppercase tracking-[.28em] text-white/30">
        {tagline}
      </div>
    </section>
  );
}
