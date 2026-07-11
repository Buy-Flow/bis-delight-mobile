import { Crown, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import tierBronze from "@/assets/tier-bronze.png";
import tierPrata from "@/assets/tier-prata.png";
import tierOuro from "@/assets/tier-ouro.png";

export type LoyaltyTier = "bronze" | "prata" | "ouro";

export const TIER_META: Record<LoyaltyTier, {
  label: string;
  tagline: string;
  image: string;
  icon: typeof Trophy;
  gradient: string;
  ring: string;
  text: string;
  minLifetime: number;
  minCards: number;
  reward: number;
  stampsPerOrder: number;
  minOrder: number;
  multiplier: string;
  benefits: string[];
}> = {
  bronze: {
    label: "Bronze",
    tagline: "Nível inicial",
    image: tierBronze,
    icon: Medal,
    gradient: "from-[#a55a2a] via-[#d67c3c] to-[#8a4520]",
    ring: "ring-[#d67c3c]/60",
    text: "text-[#f0b07a]",
    minLifetime: 0,
    minCards: 0,
    reward: 10,
    stampsPerOrder: 1,
    minOrder: 20,
    multiplier: "1×",
    benefits: [
      "Ganhe 1 selo a cada pedido pago",
      "Pedido mínimo de R$ 20 para pontuar",
      "Cupom de R$ 10 ao completar 10 selos",
      "Bônus especial no seu aniversário 🎂",
    ],
  },
  prata: {
    label: "Prata",
    tagline: "Desbloqueado com 2 cartelas cheias",
    image: tierPrata,
    icon: Trophy,
    gradient: "from-[#b7c1d0] via-[#e7edf5] to-[#8a94a6]",
    ring: "ring-[#c9d4e5]/70",
    text: "text-[#e7edf5]",
    minLifetime: 20,
    minCards: 2,
    reward: 15,
    stampsPerOrder: 2,
    minOrder: 10,
    multiplier: "2×",
    benefits: [
      "2 selos por pedido — pontue no dobro da velocidade",
      "Pedido mínimo cai para R$ 10",
      "Cupom de R$ 15 ao completar 10 selos",
      "Mantém todos os benefícios do Bronze",
    ],
  },
  ouro: {
    label: "Ouro",
    tagline: "Elite: 10 cartelas cheias completadas",
    image: tierOuro,
    icon: Crown,
    gradient: "from-[#f7c73a] via-[#ffe680] to-[#c8931a]",
    ring: "ring-neon-yellow/80",
    text: "text-neon-yellow",
    minLifetime: 100,
    minCards: 10,
    reward: 20,
    stampsPerOrder: 3,
    minOrder: 10,
    multiplier: "3×",
    benefits: [
      "3 selos por pedido — velocidade máxima 🚀",
      "Pedido mínimo de apenas R$ 10",
      "Cupom premium de R$ 20 a cada cartela",
      "Prioridade e todos os benefícios anteriores",
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
