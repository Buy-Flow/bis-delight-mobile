import { useMemo, useState } from "react";
import { Pause, Play, Clock, AlertCircle, Loader2 } from "lucide-react";
import type { Product } from "@/data/menu";
import { usePauseProduct, isProductPaused, PAUSE_INDEFINITE_ISO, isIndefinitePause } from "@/lib/menu-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PRESETS: Array<{ label: string; minutes: number | "eod" | "tomorrow" | "indefinite" }> = [
  { label: "1 hora", minutes: 60 },
  { label: "3 horas", minutes: 180 },
  { label: "Hoje até fechar", minutes: "eod" },
  { label: "Amanhã (24h)", minutes: 60 * 24 },
  { label: "Até segunda ordem", minutes: "indefinite" },
];

const REASON_SUGGESTIONS = [
  "Acabou o morango",
  "Ingrediente em falta",
  "Preparo indisponível",
  "Equipamento em manutenção",
  "Descanso do produto",
];

function endOfDayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

function minutesFromNowIso(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

function formatUntil(iso: string): string {
  if (isIndefinitePause(iso)) return "até segunda ordem";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const hhmm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `hoje às ${hhmm}`;
  if (isTomorrow) return `amanhã às ${hhmm}`;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function PauseProductControls({
  product,
  compact = false,
  onDone,
}: {
  product: Pick<Product, "id" | "name" | "pausedUntil" | "pauseReason">;
  compact?: boolean;
  onDone?: () => void;
}) {
  const paused = isProductPaused(product);
  const pause = usePauseProduct();
  const [reason, setReason] = useState(product.pauseReason ?? "");
  const [customMinutes, setCustomMinutes] = useState<string>("");

  const applyPreset = async (preset: (typeof PRESETS)[number]) => {
    let iso: string;
    if (preset.minutes === "eod") iso = endOfDayIso();
    else if (preset.minutes === "indefinite") iso = PAUSE_INDEFINITE_ISO;
    else iso = minutesFromNowIso(preset.minutes as number);
    await pause.mutateAsync({ id: product.id, pausedUntil: iso, reason: reason.trim() || null });
    toast.success(`"${product.name}" pausado (${preset.label.toLowerCase()})`);
    onDone?.();
  };

  const applyCustom = async () => {
    const n = Number(customMinutes);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Informe minutos válidos");
      return;
    }
    await pause.mutateAsync({ id: product.id, pausedUntil: minutesFromNowIso(n), reason: reason.trim() || null });
    toast.success(`"${product.name}" pausado por ${n} min`);
    setCustomMinutes("");
    onDone?.();
  };

  const resume = async () => {
    await pause.mutateAsync({ id: product.id, pausedUntil: null, reason: null });
    toast.success(`"${product.name}" reativado`);
    onDone?.();
  };

  const statusLine = useMemo(() => {
    if (!paused) return null;
    return `Pausado ${product.pausedUntil ? "· volta " + formatUntil(product.pausedUntil) : ""}`;
  }, [paused, product.pausedUntil]);

  return (
    <div className={cn("space-y-3", compact ? "p-3" : "p-0")}>
      {paused && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1 text-[12px] leading-snug">
            <div className="font-bold text-amber-100">{statusLine}</div>
            {product.pauseReason && (
              <div className="mt-0.5 text-white/70">Motivo: {product.pauseReason}</div>
            )}
          </div>
          <button
            type="button"
            onClick={resume}
            disabled={pause.isPending}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] font-black text-emerald-100 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30 disabled:opacity-60"
          >
            {pause.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Reativar agora
          </button>
        </div>
      )}

      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">
          Motivo (opcional, aparece pro cliente)
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex.: Acabou o morango hoje"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-pink/60 focus:outline-none"
          maxLength={80}
        />
        <div className="mt-1.5 flex flex-wrap gap-1">
          {REASON_SUGGESTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70 hover:bg-white/10"
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/50">
          <Clock className="h-3 w-3" />
          Pausar por
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              disabled={pause.isPending}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[12px] font-bold text-white hover:border-neon-pink/50 hover:bg-neon-pink/10 disabled:opacity-60"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            placeholder="min"
            className="w-24 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-pink/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={applyCustom}
            disabled={pause.isPending || !customMinutes}
            className="inline-flex items-center gap-1 rounded-xl bg-neon-pink px-3 py-2 text-[12px] font-black text-white glow-pink disabled:opacity-60"
          >
            {pause.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}
            Pausar
          </button>
        </div>
      </div>
    </div>
  );
}
