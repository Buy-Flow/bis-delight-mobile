import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Bike, ChefHat, PackageCheck, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type LiveOrder = {
  id: string;
  status: string;
  mode: string;
  total: number;
  created_at: string;
  paid_at: string | null;
  preparing_at: string | null;
  dispatched_at: string | null;
};

const LIVE_STATUSES = ["pago", "preparando", "saiu_para_entrega"];

export function ActiveOrderCard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [order, setOrder] = useState<LiveOrder | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setOrder(null);
      return;
    }
    let cancel = false;
    const load = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, mode, total, created_at, paid_at, preparing_at, dispatched_at")
        .eq("user_id", userId)
        .in("status", LIVE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancel) return;
      setOrder((data?.[0] as LiveOrder) ?? null);
    };
    load();
    const channel = supabase
      .channel(`active-order-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
        load,
      )
      .subscribe();
    return () => {
      cancel = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (!userId || !order) return null;

  const isDelivery = order.mode === "entrega";
  const Icon =
    order.status === "saiu_para_entrega" ? Bike : order.status === "preparando" ? ChefHat : PackageCheck;

  const label =
    order.status === "pago"
      ? "Pedido confirmado"
      : order.status === "preparando"
        ? "Preparando com carinho"
        : order.status === "saiu_para_entrega"
          ? isDelivery
            ? "Saiu para entrega"
            : "Pronto para retirada"
          : "Em andamento";

  const stepsCompleted =
    order.status === "pago" ? 1 : order.status === "preparando" ? 2 : order.status === "saiu_para_entrega" ? 3 : 0;
  const totalSteps = isDelivery ? 4 : 3;
  const pct = (stepsCompleted / totalSteps) * 100;

  return (
    <section className="relative z-30 mt-3 px-4">
      <Link
        to="/rastrear/$orderId"
        params={{ orderId: order.id }}
        aria-label="Rastrear pedido"
        className={cn(
          "group relative flex items-center gap-3 overflow-hidden rounded-3xl border border-neon-cyan/40 p-3.5 shadow-[0_20px_60px_-30px_rgba(34,211,238,0.7)] transition-transform active:scale-[0.98]",
        )}
        style={{ backgroundColor: "#0f2a3a" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-neon-cyan/15 via-transparent to-neon-pink/15"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-neon-cyan/25 blur-3xl"
        />

        {/* Animated icon */}
        <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-neon-cyan/25 to-neon-pink/25 ring-1 ring-white/15">
          <div aria-hidden className="absolute inset-0 animate-pulse rounded-2xl bg-neon-cyan/10" />
          <Icon
            className={cn(
              "relative h-6 w-6 text-neon-cyan drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]",
              order.status === "saiu_para_entrega" && "animate-[bike-move_1.6s_ease-in-out_infinite]",
              order.status === "preparando" && "animate-[chef-shake_1.2s_ease-in-out_infinite]",
            )}
          />
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-cyan opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-cyan" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-cyan/90">Ao vivo</span>
          </div>
          <div className="mt-0.5 truncate text-[15px] font-extrabold leading-tight text-white">{label}</div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-cyan via-neon-yellow to-neon-pink transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-neon-cyan">
            <Sparkles className="h-3 w-3" />
            Toque para rastrear
          </div>
        </div>

        <ChevronRight className="relative h-5 w-5 text-white/60 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}
