import { cn } from "@/lib/utils";
import type { SlaResult } from "@/lib/sla";

export function SlaBadge({ sla, compact = false }: { sla: SlaResult; compact?: boolean }) {
  const pulse = sla.status === "red" || sla.status === "warn";
  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex h-2 w-2 rounded-full",
          sla.color,
          pulse && "animate-pulse",
        )}
        title={`SLA: ${sla.label} • ${Math.round(sla.elapsedMin)}m / verde ${sla.greenMax}m • amarelo ${sla.yellowMax}m`}
        aria-label={`SLA ${sla.label}`}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1",
        sla.bg,
        sla.text,
        sla.ring,
        pulse && "animate-pulse",
      )}
      title={`Verde até ${sla.greenMax}m • Amarelo até ${sla.yellowMax}m`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", sla.color)} />
      {sla.label}
    </span>
  );
}

export function SlaBar({ sla }: { sla: SlaResult }) {
  const pct = Math.min(100, Math.round(sla.ratio * 100));
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={cn("h-full transition-all", sla.color)}
        style={{ width: `${Math.max(4, pct)}%` }}
      />
    </div>
  );
}
