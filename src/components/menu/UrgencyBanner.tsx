import { useEffect, useState } from "react";
import { Flame, Copy, Check } from "lucide-react";
import { useSiteSettings } from "@/lib/menu-data";

function fmt(ms: number) {
  if (ms <= 0) return { h: "00", m: "00", s: "00" };
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
}

export function UrgencyBanner() {
  const { data: settings } = useSiteSettings();
  const u = settings?.urgency;
  const endsAt = u?.endsAt ? new Date(u.endsAt).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!u?.active || !endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [u?.active, endsAt]);

  if (!u?.active || !endsAt) return null;
  const remaining = endsAt - now;
  if (remaining <= 0) return null;

  const { h, m, s } = fmt(remaining);

  const copy = () => {
    if (!u.couponCode) return;
    navigator.clipboard.writeText(u.couponCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto mb-3 max-w-2xl px-4">
      <div className="relative overflow-hidden rounded-3xl border border-neon-pink/40 bg-gradient-to-r from-neon-pink/20 via-neon-purple/20 to-neon-cyan/15 p-3 shadow-[0_0_40px_-10px_rgba(255,0,150,0.4)]">
        <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-neon-pink/30 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neon-pink/25 text-neon-pink">
            <Flame className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-yellow">Promoção relâmpago</div>
            <div className="truncate font-display text-[15px] font-extrabold text-white">{u.text}</div>
          </div>
          <div className="flex items-center gap-1 font-mono text-[13px] font-black text-white">
            <Cell v={h} label="h" />
            <Cell v={m} label="m" />
            <Cell v={s} label="s" />
          </div>
          {u.couponCode && (
            <button
              onClick={copy}
              className="ml-auto flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white ring-1 ring-white/20 active:scale-95"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-neon-cyan" /> : <Copy className="h-3.5 w-3.5" />}
              {u.couponCode}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Cell({ v, label }: { v: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-md bg-black/40 px-1.5 py-0.5 leading-none">
      <span className="text-[13px]">{v}</span>
      <span className="text-[8px] text-white/60">{label}</span>
    </div>
  );
}
