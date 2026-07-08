import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Painel compartilhado de ajuste de imagem (zoom + posição X/Y).
 *
 * Usado em: PhotoTab (produto), CategoryPhotoTab (categoria),
 * HeroImageEditor (destaques), NewsHeroEditor (novidades).
 *
 * Uma única fonte da verdade — mudanças de layout/estilo aqui aparecem
 * em todos os lugares automaticamente.
 */
export type ImageAdjustValues = {
  posX: number;
  posY: number;
  scale: number;
};

export function ImageAdjustPanel({
  values,
  onChange,
  defaults,
  scaleRange = { min: 0.5, max: 2.5, step: 0.05 },
  previewMaxWidth,
  renderPreview,
  previewHint = "Arraste a foto ou use os controles abaixo.",
  previewLabel = "Preview real — tamanho do card no site",
}: {
  values: ImageAdjustValues;
  onChange: (patch: Partial<ImageAdjustValues>) => void;
  defaults: ImageAdjustValues;
  scaleRange?: { min: number; max: number; step: number };
  previewMaxWidth: number;
  renderPreview: (values: ImageAdjustValues) => ReactNode;
  previewHint?: string;
  previewLabel?: string;
}) {
  const { posX, posY, scale } = values;

  const dragRef = useRef<{
    startX: number;
    startY: number;
    posX: number;
    posY: number;
    w: number;
    h: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);

  const flushPending = () => {
    rafRef.current = null;
    const p = pendingRef.current;
    pendingRef.current = null;
    if (p) onChange({ posX: p.x, posY: p.y });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget as HTMLDivElement;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX,
      posY,
      w: rect.width || previewMaxWidth,
      h: rect.height || previewMaxWidth,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    e.preventDefault();
    const dx = ((e.clientX - d.startX) / d.w) * 100;
    const dy = ((e.clientY - d.startY) / d.h) * 100;
    pendingRef.current = {
      x: clamp(d.posX + dx, -80, 80),
      y: clamp(d.posY + dy, -80, 80),
    };
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(flushPending);
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingRef.current) flushPending();
  };

  const nudge = (dx: number, dy: number) =>
    onChange({
      posX: clamp(posX + dx, -80, 80),
      posY: clamp(posY + dy, -80, 80),
    });

  const reset = () => onChange({ ...defaults });

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
          {previewLabel}
        </div>
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-black/40 p-4">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="touch-none select-none cursor-grab active:cursor-grabbing [&_*]:pointer-events-none"
            style={{ width: "100%", maxWidth: previewMaxWidth }}
          >
            {renderPreview(values)}
          </div>
          <div className="text-[10px] text-white/40">{previewHint}</div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
            <span>Zoom</span>
            <span className="text-white/50">{scale.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={scaleRange.min}
            max={scaleRange.max}
            step={scaleRange.step}
            value={scale}
            onChange={(e) => onChange({ scale: Number(e.target.value) })}
            className="w-full accent-neon-cyan"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
              <span>Horizontal</span>
              <span className="text-white/50">{posX.toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={posX}
              onChange={(e) => onChange({ posX: Number(e.target.value) })}
              className="w-full accent-neon-cyan"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
              <span>Vertical</span>
              <span className="text-white/50">{posY.toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={posY}
              onChange={(e) => onChange({ posY: Number(e.target.value) })}
              className="w-full accent-neon-cyan"
            />
          </div>
          <div className="flex flex-col items-stretch justify-end gap-1">
            <div className="grid grid-cols-3 gap-1">
              <div />
              <NudgeBtn onClick={() => nudge(0, -3)}>↑</NudgeBtn>
              <div />
              <NudgeBtn onClick={() => nudge(-3, 0)}>←</NudgeBtn>
              <NudgeBtn onClick={reset}>◎</NudgeBtn>
              <NudgeBtn onClick={() => nudge(3, 0)}>→</NudgeBtn>
              <div />
              <NudgeBtn onClick={() => nudge(0, 3)}>↓</NudgeBtn>
              <div />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={reset}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
        >
          Resetar posição e zoom
        </button>
      </div>
    </div>
  );
}

function NudgeBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid h-7 place-items-center rounded-md border border-white/10 bg-white/5 text-xs text-white/80 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
