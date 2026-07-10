import { Truck, PartyPopper } from "lucide-react";
import { useSettings } from "@/lib/menu-data";
import { brl, useCart } from "@/lib/cart-context";

export function FreeDeliveryBar() {
  const { data: settings } = useSettings();
  const { subtotal, items } = useCart();
  const threshold = Number(settings?.freeDeliveryThreshold ?? 0);
  if (!threshold || items.length === 0) return null;

  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  const missing = Math.max(0, threshold - subtotal);
  const done = missing <= 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-white">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-neon-cyan/15 text-neon-cyan">
            {done ? <PartyPopper className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
          </span>
          <div className="text-[13px] font-semibold leading-tight">
            {done ? (
              <span className="text-neon-cyan">Você ganhou entrega grátis!</span>
            ) : (
              <>
                Faltam <span className="font-extrabold text-neon-yellow">{brl(missing)}</span> para <span className="font-extrabold">entrega grátis</span>
              </>
            )}
          </div>
        </div>
        <span className="text-[11px] font-black text-white/60">{pct}%</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neon-pink via-neon-yellow to-neon-cyan transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
