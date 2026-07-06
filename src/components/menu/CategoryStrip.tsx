import { CATEGORIES } from "@/data/menu";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Cherry,
  IceCream,
  IceCream2,
  Cookie,
  Baby,
  GlassWater,
  CupSoda,
  type LucideIcon,
} from "lucide-react";

type Accent = {
  icon: LucideIcon;
  bg: string; // solid bg for icon circle
  ring: string; // active ring color
  glow: string; // active shadow color
};

const ACCENTS: Record<string, Accent> = {
  all: {
    icon: Sparkles,
    bg: "bg-white/15",
    ring: "ring-white/70",
    glow: "shadow-[0_0_18px_rgba(255,255,255,0.25)]",
  },
  acai: {
    icon: Cherry,
    bg: "bg-[oklch(0.55_0.18_305)]",
    ring: "ring-neon-cyan",
    glow: "shadow-[0_0_18px_oklch(0.86_0.18_200/0.4)]",
  },
  tacas: {
    icon: IceCream2,
    bg: "bg-neon-pink",
    ring: "ring-neon-pink",
    glow: "shadow-[0_0_18px_oklch(0.72_0.26_350/0.5)]",
  },
  mix: {
    icon: IceCream,
    bg: "bg-neon-cyan",
    ring: "ring-neon-cyan",
    glow: "shadow-[0_0_18px_oklch(0.86_0.18_200/0.5)]",
  },
  kids: {
    icon: Baby,
    bg: "bg-neon-pink",
    ring: "ring-neon-pink",
    glow: "shadow-[0_0_18px_oklch(0.72_0.26_350/0.5)]",
  },
  casquinhas: {
    icon: Cookie,
    bg: "bg-neon-yellow",
    ring: "ring-neon-yellow",
    glow: "shadow-[0_0_18px_oklch(0.92_0.20_100/0.5)]",
  },
  shakes: {
    icon: GlassWater,
    bg: "bg-neon-cyan",
    ring: "ring-neon-cyan",
    glow: "shadow-[0_0_18px_oklch(0.86_0.18_200/0.5)]",
  },
  copos: {
    icon: CupSoda,
    bg: "bg-neon-pink",
    ring: "ring-neon-pink",
    glow: "shadow-[0_0_18px_oklch(0.72_0.26_350/0.5)]",
  },
};

export function CategoryStrip({
  active,
  onChange,
}: {
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <section id="categorias" className="pb-4">
      <div className="mb-3 flex items-end justify-between px-4">
        <h2 className="font-display text-xl font-extrabold text-white">
          Categorias
        </h2>
        <span className="text-[11px] uppercase tracking-widest text-white/50">
          Deslize →
        </span>
      </div>

      <div className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 pt-2">
        {CATEGORIES.map((c) => {
          const isActive = active === c.id;
          const accent = ACCENTS[c.id] ?? ACCENTS.all;
          const Icon = accent.icon;
          return (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              aria-pressed={isActive}
              className={cn(
                "group relative snap-start shrink-0 w-[112px] h-[172px] rounded-[24px]",
                "bg-[#280a66] transition active:scale-95 overflow-hidden",
                "shadow-[0_14px_28px_-10px_rgba(0,0,0,0.7),0_4px_10px_-4px_rgba(0,0,0,0.5)]",
                "ring-1 ring-white/5",
                isActive && `ring-2 ${accent.ring} ${accent.glow}`,
              )}
            >
              {/* Sunken photo area (top 60%) */}
              <div
                className="relative h-[102px] w-full overflow-hidden"
                style={{
                  boxShadow:
                    "inset 0 10px 18px -8px rgba(0,0,0,0.75), inset 0 -6px 14px -6px rgba(0,0,0,0.55), inset 0 0 22px rgba(0,0,0,0.35)",
                }}
              >
                <img
                  src={c.image}
                  alt={c.name}
                  className="absolute inset-0 h-full w-full object-cover drop-shadow-[0_18px_18px_rgba(0,0,0,0.55)]"
                />
                {/* soft vignette to reinforce depth */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.35)_100%)]" />
              </div>

              {/* Elevated base platform */}
              <div
                className="absolute inset-x-0 bottom-0 h-[70px] rounded-b-[24px]"
                style={{
                  background:
                    "linear-gradient(180deg, #3a1585 0%, #2f0f70 55%, #26095d 100%)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 2px 0 rgba(180,140,255,0.18), 0 -8px 18px -6px rgba(0,0,0,0.55), 0 6px 14px -6px rgba(0,0,0,0.6)",
                }}
              >
                {/* highlighted top rim */}
                <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              </div>

              {/* Floating icon badge — sits on the elevated platform */}
              <div
                className="absolute left-1/2 top-[102px] grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-b from-[#4a22a0] to-[#2f0f70] ring-2 ring-[#8a6bff]/70"
                style={{
                  boxShadow:
                    "0 8px 16px -4px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
                }}
              >
                <Icon className="h-5 w-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" strokeWidth={2} />
              </div>

              {/* Engraved label */}
              <div className="absolute inset-x-0 bottom-3 px-2 text-center">
                <div
                  className="truncate text-[11px] font-black uppercase tracking-wide text-white/95"
                  style={{
                    textShadow:
                      "0 -1px 0 rgba(20,0,55,0.9), 0 1px 0 rgba(255,255,255,0.28), 0 2px 3px rgba(0,0,0,0.35)",
                  }}
                >
                  {c.name}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
