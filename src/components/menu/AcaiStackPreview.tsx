import { useMemo, useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { OptionGroup, OptionItem, Product } from "@/data/menu";

type Selection = Record<string, string[]>;
type LayerKind = "base" | "fruit" | "sauce" | "extra";

/* ---------- classificação ---------- */
function classifyGroup(name: string): LayerKind {
  const n = name.toLowerCase();
  if (/(tamanho|base|cremoso|creme|sabor(?!izante))/.test(n)) return "base";
  if (/(fruta|banana|morango|kiwi|manga|abacaxi|frutas)/.test(n)) return "fruit";
  if (/(cobertura|calda|xarope|molho|topping|nutella|leite condensado|mel)/.test(n)) return "sauce";
  return "extra";
}

/* ---------- ícone por rótulo ---------- */
function emojiFor(label: string): string {
  const n = label.toLowerCase();
  if (n.includes("banana")) return "🍌";
  if (n.includes("morango") || n.includes("fresa")) return "🍓";
  if (n.includes("kiwi")) return "🥝";
  if (n.includes("uva")) return "🍇";
  if (n.includes("manga")) return "🥭";
  if (n.includes("abacaxi") || n.includes("piña")) return "🍍";
  if (n.includes("maçã") || n.includes("maca")) return "🍎";
  if (n.includes("cereja")) return "🍒";
  if (n.includes("melancia")) return "🍉";
  if (n.includes("coco")) return "🥥";
  if (n.includes("laranja") || n.includes("acerola")) return "🍊";
  if (n.includes("granola") || n.includes("aveia") || n.includes("cereal")) return "🌾";
  if (n.includes("paçoca") || n.includes("pacoca") || n.includes("amendo")) return "🥜";
  if (n.includes("chocolate") || n.includes("brigadeiro") || n.includes("bis") || n.includes("kit kat")) return "🍫";
  if (n.includes("nutella") || n.includes("avelã")) return "🟤";
  if (n.includes("leite ninho") || n.includes("ninho") || n.includes("leite po")) return "🥛";
  if (n.includes("leite condensado")) return "🍮";
  if (n.includes("mel")) return "🍯";
  if (n.includes("ovomaltine")) return "🟠";
  if (n.includes("morang")) return "🍓";
  if (n.includes("biscoito") || n.includes("bolacha") || n.includes("wafer") || n.includes("cookie")) return "🍪";
  if (n.includes("marshmallow")) return "🍡";
  if (n.includes("bala") || n.includes("confeito") || n.includes("granulado")) return "🍬";
  if (n.includes("m&m") || n.includes("mm") || n.includes("colorido")) return "🌈";
  if (n.includes("sorvete") || n.includes("gelato")) return "🍨";
  if (n.includes("morango")) return "🍓";
  return "✨";
}

/* ---------- cor por rótulo (para calda/base) ---------- */
function colorFor(label: string): string {
  const n = label.toLowerCase();
  if (n.includes("chocolate") || n.includes("brigadeiro") || n.includes("nutella")) return "#3b1a0a";
  if (n.includes("morango")) return "#e5325c";
  if (n.includes("caramelo") || n.includes("caramel")) return "#b06a1b";
  if (n.includes("leite condensado") || n.includes("condensado")) return "#f6ecc8";
  if (n.includes("mel")) return "#f0a929";
  if (n.includes("ovomaltine")) return "#c96b12";
  if (n.includes("baunilha")) return "#f2e6c0";
  if (n.includes("uva")) return "#4b1a5b";
  return "#5b2076";
}

type PickedOption = { group: OptionGroup; opt: OptionItem; kind: LayerKind };

function pickedList(groups: OptionGroup[], sel: Selection): PickedOption[] {
  const out: PickedOption[] = [];
  for (const g of groups) {
    const kind = classifyGroup(g.name);
    const ids = sel[g.id] ?? [];
    for (const id of ids) {
      const opt = g.options.find((o) => o.id === id);
      if (opt) out.push({ group: g, opt, kind });
    }
  }
  return out;
}

export function AcaiStackPreview({
  product,
  groups,
  selection,
  bump,
  className,
}: {
  product: Product;
  groups: OptionGroup[];
  selection: Selection;
  /** número que muda a cada seleção para acionar animação */
  bump: number;
  className?: string;
}) {
  const picked = useMemo(() => pickedList(groups, selection), [groups, selection]);

  const base = picked.find((p) => p.kind === "base");
  const fruits = picked.filter((p) => p.kind === "fruit");
  const sauces = picked.filter((p) => p.kind === "sauce");
  const extras = picked.filter((p) => p.kind === "extra");

  // Tamanho do enchimento pelo índice da base entre as opções do grupo
  const baseGroup = groups.find((g) => classifyGroup(g.name) === "base");
  const baseIdx = base && baseGroup
    ? Math.max(0, baseGroup.options.findIndex((o) => o.id === base.opt.id))
    : 0;
  const totalBases = baseGroup?.options.length ?? 1;
  const fillLevel = 0.55 + (baseIdx / Math.max(1, totalBases - 1)) * 0.35; // 55% → 90%

  const baseColor = base ? colorFor(base.opt.label) : "#4a1a5c";

  const [pulse, setPulse] = useState(0);
  const prevBump = useRef(bump);
  useEffect(() => {
    if (prevBump.current !== bump) {
      prevBump.current = bump;
      setPulse((p) => p + 1);
    }
  }, [bump]);

  // Geometria do copo (viewBox 200x260)
  const VB_W = 200;
  const VB_H = 260;
  const cupTop = 42;
  const cupBottom = 230;
  const cupInsetTop = 8;
  const cupInsetBottom = 30;
  const rimRy = 12;

  const fillTopY = cupBottom - (cupBottom - cupTop - 6) * fillLevel;

  return (
    <div className={cn("relative h-full w-full", className)}>
      {/* Halo neon atrás do copo */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_65%,oklch(0.86_0.18_200_/_0.35),transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 mx-auto h-8 w-[70%] rounded-[50%] bg-black/60 blur-2xl" />

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="mx-auto h-full w-full drop-shadow-[0_25px_25px_rgba(0,0,0,0.55)]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="cupBody" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id="fillGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={baseColor} stopOpacity="1" />
            <stop offset="1" stopColor="#1b0630" stopOpacity="1" />
          </linearGradient>
          <radialGradient id="topShine" cx="0.5" cy="0.3" r="0.6">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          {/* Clip do interior do copo */}
          <clipPath id="cupClip">
            <path
              d={`M ${28 + cupInsetTop} ${cupTop + 4}
                  L ${VB_W - 28 - cupInsetTop} ${cupTop + 4}
                  L ${VB_W - 40 - cupInsetBottom + 20} ${cupBottom - 4}
                  Q ${VB_W / 2} ${cupBottom + 8} ${40 + cupInsetBottom - 20} ${cupBottom - 4}
                  Z`}
            />
          </clipPath>
        </defs>

        {/* Silhueta do copo */}
        <path
          d={`M ${28} ${cupTop}
              L ${VB_W - 28} ${cupTop}
              L ${VB_W - 40} ${cupBottom}
              Q ${VB_W / 2} ${cupBottom + 14} ${40} ${cupBottom}
              Z`}
          fill="url(#cupBody)"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.5"
        />
        {/* Rim (elipse superior) */}
        <ellipse
          cx={VB_W / 2}
          cy={cupTop}
          rx={(VB_W - 56) / 2}
          ry={rimRy}
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.5"
        />

        {/* Conteúdo dentro do copo */}
        <g clipPath="url(#cupClip)">
          {/* Enchimento base (açaí/cremoso) */}
          <g style={{ transition: "transform 400ms cubic-bezier(.2,.9,.2,1)" }}>
            <rect
              x="0"
              y={fillTopY}
              width={VB_W}
              height={VB_H - fillTopY}
              fill="url(#fillGrad)"
              style={{ transition: "y 500ms cubic-bezier(.2,.9,.2,1)" }}
            />
            {/* Superfície superior (elíptica) para efeito 3D */}
            <ellipse
              cx={VB_W / 2}
              cy={fillTopY}
              rx={(VB_W - 60) / 2}
              ry={7}
              fill={baseColor}
              style={{ transition: "cy 500ms cubic-bezier(.2,.9,.2,1)" }}
            />
            <ellipse
              cx={VB_W / 2}
              cy={fillTopY - 1}
              rx={(VB_W - 76) / 2}
              ry={4}
              fill="url(#topShine)"
              style={{ transition: "cy 500ms cubic-bezier(.2,.9,.2,1)" }}
            />
          </g>

          {/* Caldas escorrendo do topo do enchimento */}
          {sauces.map((s, i) => {
            const cx = 50 + ((i * 37) % (VB_W - 100));
            const color = colorFor(s.opt.label);
            return (
              <g key={s.opt.id} style={{ transformOrigin: `${cx}px ${fillTopY}px` }}>
                <path
                  d={`M ${cx - 18} ${fillTopY - 1}
                      Q ${cx - 10} ${fillTopY + 14}, ${cx} ${fillTopY + 4}
                      T ${cx + 20} ${fillTopY + 12}
                      L ${cx + 22} ${fillTopY - 1} Z`}
                  fill={color}
                  opacity="0.95"
                  style={{
                    animation: `sauce-drip 700ms cubic-bezier(.2,.9,.2,1) both`,
                    animationDelay: `${i * 90}ms`,
                  }}
                />
                <ellipse
                  cx={cx + 5}
                  cy={fillTopY + 18}
                  rx="8"
                  ry="3"
                  fill={color}
                  opacity="0.7"
                />
              </g>
            );
          })}

          {/* Frutas — pousadas sobre a superfície */}
          {fruits.map((f, i) => {
            const spread = fruits.length;
            const step = (VB_W - 90) / Math.max(1, spread);
            const cx = 45 + step * (i + 0.5);
            const cy = fillTopY - 4 - ((i % 2) * 6);
            return (
              <g
                key={f.opt.id}
                style={{
                  animation: `topping-pop 450ms cubic-bezier(.34,1.56,.64,1) both`,
                  animationDelay: `${i * 70}ms`,
                }}
              >
                <ellipse cx={cx} cy={cy + 5} rx="10" ry="3" fill="rgba(0,0,0,0.35)" />
                <text
                  x={cx}
                  y={cy + 6}
                  fontSize="20"
                  textAnchor="middle"
                  style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))" }}
                >
                  {emojiFor(f.opt.label)}
                </text>
              </g>
            );
          })}

          {/* Adicionais — polvilhados no topo */}
          {extras.map((e, i) => {
            const cx = 40 + ((i * 29) % (VB_W - 80));
            const cy = fillTopY - 14 - ((i % 3) * 8);
            return (
              <g
                key={e.opt.id}
                style={{
                  animation: `topping-pop 450ms cubic-bezier(.34,1.56,.64,1) both`,
                  animationDelay: `${120 + i * 60}ms`,
                }}
              >
                <text
                  x={cx}
                  y={cy}
                  fontSize="16"
                  textAnchor="middle"
                  style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))" }}
                >
                  {emojiFor(e.opt.label)}
                </text>
              </g>
            );
          })}
        </g>

        {/* Reflexo lateral (3D) */}
        <path
          d={`M ${36} ${cupTop + 8} L ${41} ${cupBottom - 6}`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={`M ${VB_W - 36} ${cupTop + 20} L ${VB_W - 44} ${cupBottom - 20}`}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Chips no rodapé com o resumo das camadas */}
      <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-wrap items-center justify-center gap-1 px-2">
        {base && (
          <LayerChip
            key={`b-${base.opt.id}-${pulse}`}
            color="#3b1447"
            label={base.opt.label}
            icon="🍧"
          />
        )}
        {fruits.slice(0, 3).map((f) => (
          <LayerChip
            key={`f-${f.opt.id}-${pulse}`}
            color="#a1245b"
            label={f.opt.label}
            icon={emojiFor(f.opt.label)}
          />
        ))}
        {fruits.length > 3 && <MoreChip n={fruits.length - 3} />}
        {sauces.slice(0, 2).map((s) => (
          <LayerChip
            key={`s-${s.opt.id}-${pulse}`}
            color={colorFor(s.opt.label)}
            label={s.opt.label}
            icon="💧"
          />
        ))}
        {extras.length > 0 && <MoreChip n={extras.length} label="add" />}
        {!base && fruits.length === 0 && sauces.length === 0 && extras.length === 0 && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
            Monte o seu ✨
          </span>
        )}
      </div>

      <span className="sr-only">{product.name}</span>
    </div>
  );
}

function LayerChip({ color, label, icon }: { color: string; label: string; icon: string }) {
  return (
    <span
      className="inline-flex max-w-[110px] items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ring-1 ring-white/25 backdrop-blur-sm"
      style={{
        backgroundColor: `${color}cc`,
        animation: "chip-in 350ms cubic-bezier(.34,1.56,.64,1) both",
      }}
    >
      <span className="text-[11px] leading-none">{icon}</span>
      <span className="truncate leading-none">{label}</span>
    </span>
  );
}

function MoreChip({ n, label = "" }: { n: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-extrabold text-white ring-1 ring-white/25">
      +{n}
      {label && <span className="opacity-70">{label}</span>}
    </span>
  );
}
