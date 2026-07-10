import { Crown, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import tierBronze from "@/assets/tier-bronze.png";
import tierPrata from "@/assets/tier-prata.png";
import tierOuro from "@/assets/tier-ouro.png";

export type LoyaltyTier = "bronze" | "prata" | "ouro";

export const TIER_META: Record<LoyaltyTier, {
  label: string;
  image: string;
  icon: typeof Trophy;
  gradient: string;
  ring: string;
  text: string;
  minLifetime: number;
  reward: number;
  stampsPerOrder: number;
  benefits: string[];
}> = {
  bronze: {
    label: "Bronze",
    image: tierBronze,
    icon: Medal,
    gradient: "from-[#a55a2a] via-[#d67c3c] to-[#8a4520]",
    ring: "ring-[#d67c3c]/60",
    text: "text-[#f0b07a]",
    minLifetime: 0,
    reward: 20,
    stampsPerOrder: 1,
    benefits: [
      "1 selo por pedido pago",
      "Cupom de R$ 20 a cada 10 selos",
      "Bônus de aniversário",
    ],
  },
  prata: {
    label: "Prata",
    image: tierPrata,
    icon: Trophy,
    gradient: "from-[#b7c1d0] via-[#e7edf5] to-[#8a94a6]",
    ring: "ring-[#c9d4e5]/70",
    text: "text-[#e7edf5]",
    minLifetime: 10,
    reward: 25,
    stampsPerOrder: 2,
    benefits: [
      "2 selos por pedido (o dobro!)",
      "Cupom de R$ 25 a cada 10 selos",
      "Todos os benefícios do Bronze",
    ],
  },
  ouro: {
    label: "Ouro",
    image: tierOuro,
    icon: Crown,
    gradient: "from-[#f7c73a] via-[#ffe680] to-[#c8931a]",
    ring: "ring-neon-yellow/80",
    text: "text-neon-yellow",
    minLifetime: 30,
    reward: 30,
    stampsPerOrder: 3,
    benefits: [
      "3 selos por pedido (o triplo!)",
      "Cupom de R$ 30 a cada 10 selos",
      "Todos os benefícios anteriores",
    ],
  },
};

export function TierBadge({
  tier,
  size = "md",
  showLabel = true,
  className,
}: {
  tier: LoyaltyTier;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  const meta = TIER_META[tier];
  const dims = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-16 w-16" : "h-11 w-11";
  const textSize = size === "sm" ? "text-[10px]" : size === "lg" ? "text-sm" : "text-[11px]";
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div className={cn("relative shrink-0", dims)}>
        <div
          aria-hidden
          className={cn("absolute inset-0 rounded-full bg-gradient-to-br opacity-40 blur-md", meta.gradient)}
        />
        <img
          src={meta.image}
          alt={`Nível ${meta.label}`}
          loading="lazy"
          width={128}
          height={128}
          className="relative h-full w-full object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.4)]"
        />
      </div>
      {showLabel && (
        <div className="min-w-0">
          <div className={cn("text-[9px] font-bold uppercase tracking-[0.22em] text-white/60")}>Nível</div>
          <div className={cn("font-black leading-none", textSize, meta.text)}>{meta.label}</div>
        </div>
      )}
    </div>
  );
}
