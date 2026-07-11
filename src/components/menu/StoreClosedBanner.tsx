import { Clock, MoonStar } from "lucide-react";
import { useStoreStatus } from "@/lib/store-status";

function formatDuration(mins: number): string {
  if (mins < 1) return "menos de 1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function StoreClosedBanner() {
  const status = useStoreStatus();
  if (!status.isClosed) return null;

  const isOverride = status.reason === "override-closed";
  const nextLabel = status.nextOpenLabel;
  const untilOpen = status.minutesUntilOpen;

  const headline = isOverride ? "Estamos temporariamente fechados" : "Loja fechada no momento";
  const body = isOverride
    ? "Voltamos assim que possível. Você pode explorar o cardápio à vontade."
    : nextLabel
      ? `Reabrimos ${nextLabel}${untilOpen !== null && untilOpen <= 24 * 60 ? ` · em ${formatDuration(untilOpen)}` : ""}.`
      : "Confira nossos horários abaixo.";

  return (
    <div className="mx-4 mt-3" role="status" aria-live="polite">
      <div
        className="relative overflow-hidden rounded-2xl border border-red-400/30 bg-gradient-to-br from-red-500/15 via-rose-500/10 to-purple-900/40 p-4 shadow-[0_10px_30px_-15px_rgba(255,60,90,0.5)] backdrop-blur"
      >
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-red-500/20 blur-2xl" />
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/25 ring-1 ring-red-400/40 text-red-100">
            <MoonStar className="h-5 w-5" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-100 ring-1 ring-red-400/40">
                <span className="h-1.5 w-1.5 rounded-full bg-red-300 animate-pulse" />
                Fechado
              </span>
              {status.override === "auto" && status.todayHours && !status.todayHours.closed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70 ring-1 ring-white/10">
                  <Clock className="h-3 w-3" />
                  Hoje {status.todayHours.open.slice(0, 5)} — {status.todayHours.close.slice(0, 5)}
                </span>
              )}
            </div>
            <div className="mt-1 text-[15px] font-black leading-tight text-white">{headline}</div>
            <div className="mt-0.5 text-[12px] leading-snug text-white/80">{body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
