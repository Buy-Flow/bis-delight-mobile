import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Bike,
  ChefHat,
  CheckCircle2,
  ClipboardList,
  Flame,
  Loader2,
  MapPin,
  Package,
  PauseCircle,
  Phone,
  PlayCircle,
  Radio,
  ShoppingBag,
  Timer,
  TrendingUp,
  Wifi,
  WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSiteSettings, useUpdateSiteSettings } from "@/lib/menu-data";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/rush")({
  head: () => ({
    meta: [
      { title: "Rush — Painel Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RushPage,
});

type OrderStatus =
  | "pendente"
  | "pago"
  | "preparando"
  | "saiu_para_entrega"
  | "entregue"
  | "cancelado";

type Order = {
  id: string;
  user_id: string | null;
  mode: string;
  customer_name: string;
  phone: string;
  address: string | null;
  reference: string | null;
  note: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  created_at: string;
  preparing_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  order_items: {
    id: string;
    name: string;
    quantity: number;
    size: string | null;
    flavor: string | null;
  }[];
};

type LaneId = "novos" | "cozinha" | "rota";

const LANES: { id: LaneId; label: string; icon: typeof Flame; accent: string; ring: string }[] = [
  { id: "novos", label: "Novos", icon: Flame, accent: "text-neon-yellow", ring: "shadow-[0_0_30px_-8px_var(--neon-yellow)]" },
  { id: "cozinha", label: "Cozinha", icon: ChefHat, accent: "text-neon-cyan", ring: "shadow-[0_0_30px_-8px_var(--neon-cyan)]" },
  { id: "rota", label: "Rota", icon: Bike, accent: "text-neon-pink", ring: "shadow-[0_0_30px_-8px_var(--neon-pink)]" },
];

const STATUSES_IN_LANE: Record<LaneId, OrderStatus[]> = {
  novos: ["pendente", "pago"],
  cozinha: ["preparando"],
  rota: ["saiu_para_entrega"],
};

const isToday = (d: Date) => {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

function ageMinutes(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function formatAge(iso: string, tick: number): string {
  void tick;
  const min = ageMinutes(iso);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h}h${rest}m` : `${h}h`;
}

function firstName(name: string): string {
  return (name || "").trim().split(/\s+/)[0] || "Cliente";
}

function digitsOnly(s: string): string {
  const d = (s || "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("55") ? d : `55${d}`;
}

/* ---------- Sound ---------- */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const beep = (freq: number, start: number, dur = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.02);
    };
    beep(880, 0);
    beep(1320, 0.2);
    beep(1760, 0.4, 0.25);
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* noop */
  }
}

/* ---------- Page ---------- */
function RushPage() {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading } = useIsAdmin();
  const { data: settings } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [lane, setLane] = useState<LaneId>("novos");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0);

  // sound preference
  const [soundOn, setSoundOn] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("rush-sound") !== "0";
  });
  useEffect(() => {
    localStorage.setItem("rush-sound", soundOn ? "1" : "0");
  }, [soundOn]);

  const knownIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  // 30s tick for age labels
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // fetch + subscribe
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,user_id,mode,customer_name,phone,address,reference,note,subtotal,delivery_fee,total,status,created_at,preparing_at,dispatched_at,delivered_at,order_items(id,name,quantity,size,flavor)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) {
        toast.error("Não consegui carregar pedidos.");
        return;
      }
      const list = (data ?? []) as unknown as Order[];
      // detect new incoming orders after first load
      if (initialized.current) {
        const incoming = list.filter(
          (o) =>
            !knownIds.current.has(o.id) &&
            (o.status === "pendente" || o.status === "pago") &&
            isToday(new Date(o.created_at)),
        );
        if (incoming.length && soundOn) playChime();
        if (incoming.length)
          toast.success(`${incoming.length} novo${incoming.length > 1 ? "s" : ""} pedido${incoming.length > 1 ? "s" : ""}!`);
      }
      knownIds.current = new Set(list.map((o) => o.id));
      initialized.current = true;
      setOrders(list);
    };

    load();

    const channel = supabase
      .channel("rush-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const poll = window.setInterval(load, 45_000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(poll);
    };
    // soundOn is intentionally read from ref-like closure via state; safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const todayList = useMemo(
    () => (orders ?? []).filter((o) => isToday(new Date(o.created_at))),
    [orders],
  );

  const kpis = useMemo(() => {
    const list = todayList;
    const paid = list.filter((o) =>
      ["pago", "preparando", "saiu_para_entrega", "entregue"].includes(o.status),
    );
    const revenue = paid.reduce((s, o) => s + Number(o.total || 0), 0);
    const avgTicket = paid.length ? revenue / paid.length : 0;
    const fila = list.filter((o) => o.status === "pendente" || o.status === "pago").length;
    const cozinha = list.filter((o) => o.status === "preparando").length;
    const rota = list.filter((o) => o.status === "saiu_para_entrega").length;
    // avg prep time from preparing_at -> dispatched_at OR delivered_at (retirada)
    const preps = list
      .map((o) => {
        if (!o.preparing_at) return null;
        const end = o.dispatched_at ?? o.delivered_at;
        if (!end) return null;
        return (new Date(end).getTime() - new Date(o.preparing_at).getTime()) / 60000;
      })
      .filter((v): v is number => v !== null && v > 0 && v < 240);
    const avgPrep = preps.length ? preps.reduce((a, b) => a + b, 0) / preps.length : 0;
    return { fila, cozinha, rota, revenue, avgTicket, avgPrep, delivered: list.filter((o) => o.status === "entregue").length };
  }, [todayList]);

  const laneList = useMemo(() => {
    const allowed = STATUSES_IN_LANE[lane];
    return (orders ?? [])
      .filter((o) => allowed.includes(o.status))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [orders, lane]);

  const laneCounts = useMemo(() => {
    const c: Record<LaneId, number> = { novos: 0, cozinha: 0, rota: 0 };
    (orders ?? []).forEach((o) => {
      for (const l of LANES) if (STATUSES_IN_LANE[l.id].includes(o.status)) c[l.id]++;
    });
    return c;
  }, [orders]);

  const setStatus = async (order: Order, status: OrderStatus) => {
    setBusyId(order.id);
    const prev = order.status;
    // optimistic
    setOrders((cur) =>
      cur ? cur.map((o) => (o.id === order.id ? { ...o, status } : o)) : cur,
    );
    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
    setBusyId(null);
    if (error) {
      setOrders((cur) => (cur ? cur.map((o) => (o.id === order.id ? { ...o, status: prev } : o)) : cur));
      toast.error("Erro ao atualizar: " + error.message);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(20);
    toast.success("Pedido atualizado.");
  };

  const advance = (o: Order) => {
    if (o.status === "pendente" || o.status === "pago") return setStatus(o, "preparando");
    if (o.status === "preparando") {
      return setStatus(o, o.mode === "entrega" ? "saiu_para_entrega" : "entregue");
    }
    if (o.status === "saiu_para_entrega") return setStatus(o, "entregue");
  };

  const toggleStore = () => {
    if (!settings) return;
    const next = settings.openOverride === "closed" ? "auto" : "closed";
    updateSettings.mutate(
      { ...settings, openOverride: next },
      {
        onSuccess: () => {
          toast[next === "closed" ? "warning" : "success"](
            next === "closed" ? "Novos pedidos pausados." : "Loja aceitando pedidos.",
          );
        },
        onError: (e: any) => toast.error("Erro: " + e.message),
      },
    );
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.10_0.08_300)] text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.10_0.08_300)] px-4 text-white">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-black">Acesso negado</h1>
          <p className="mt-2 text-sm text-white/60">Sua conta não tem permissão de administrador.</p>
          <button
            onClick={signOut}
            className="mt-6 rounded-2xl bg-neon-pink px-4 py-2 text-sm font-bold text-white"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  const isPaused = settings?.openOverride === "closed";

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_oklch(0.18_0.15_305)_0%,_oklch(0.08_0.08_305)_60%)] pb-32 text-white">
      <Toaster theme="dark" richColors position="top-center" />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[oklch(0.09_0.08_305)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2.5">
          <Link
            to="/admin"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-white/80 hover:bg-white/10"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-neon-pink to-neon-yellow shadow-[0_0_20px_-4px_var(--neon-pink)]">
              <Flame className="h-4 w-4 text-[oklch(0.13_0.08_305)]" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-black leading-none">Rush</h1>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/50">
                {connected ? (
                  <>
                    <Wifi className="h-3 w-3 text-emerald-400" /> ao vivo
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-white/40" /> reconectando
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleStore}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition",
                isPaused
                  ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/40"
                  : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40",
              )}
              aria-label={isPaused ? "Retomar pedidos" : "Pausar pedidos"}
            >
              {isPaused ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isPaused ? "Pausado" : "Aberto"}</span>
            </button>
            <button
              type="button"
              onClick={() => setSoundOn((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white/80 hover:bg-white/10"
              aria-label={soundOn ? "Silenciar" : "Ativar som"}
            >
              {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-white/40" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 pt-3">
        {/* KPIs */}
        <section className="grid grid-cols-3 gap-2">
          <KpiTile
            label="Fila"
            value={kpis.fila}
            icon={ShoppingBag}
            accent="text-neon-yellow"
            border="border-neon-yellow/30"
            glow={kpis.fila > 0 ? "shadow-[0_0_30px_-10px_var(--neon-yellow)]" : ""}
            pulse={kpis.fila > 0}
          />
          <KpiTile
            label="Cozinha"
            value={kpis.cozinha}
            icon={ChefHat}
            accent="text-neon-cyan"
            border="border-neon-cyan/30"
          />
          <KpiTile
            label="Rota"
            value={kpis.rota}
            icon={Bike}
            accent="text-neon-pink"
            border="border-neon-pink/30"
          />
          <KpiTile
            label="Hoje"
            value={brl(kpis.revenue)}
            icon={TrendingUp}
            accent="text-emerald-300"
            border="border-emerald-400/30"
            small
          />
          <KpiTile
            label="Ticket"
            value={brl(kpis.avgTicket)}
            icon={Radio}
            accent="text-white/90"
            border="border-white/10"
            small
          />
          <KpiTile
            label="Prep méd."
            value={kpis.avgPrep > 0 ? `${Math.round(kpis.avgPrep)}m` : "—"}
            icon={Timer}
            accent="text-white/90"
            border="border-white/10"
            small
          />
        </section>

        {/* Pause banner */}
        {isPaused && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <PauseCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">Loja pausada — o site não aceita novos pedidos.</span>
            <button
              onClick={toggleStore}
              className="rounded-full bg-red-500/30 px-2.5 py-1 text-[11px] font-bold hover:bg-red-500/40"
            >
              Reabrir
            </button>
          </div>
        )}

        {/* Lane tabs */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
          {LANES.map((l) => {
            const active = lane === l.id;
            const count = laneCounts[l.id];
            const Icon = l.icon;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLane(l.id)}
                className={cn(
                  "relative flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold transition",
                  active
                    ? "bg-[oklch(0.16_0.12_305)] text-white ring-1 ring-white/15"
                    : "text-white/60 hover:text-white/80",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", active ? l.accent : "")} />
                <span>{l.label}</span>
                <span
                  className={cn(
                    "grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[10px] font-black",
                    active ? "bg-neon-pink text-white" : "bg-white/10 text-white/70",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Lane list */}
        <section className="mt-3 space-y-2.5">
          {orders === null ? (
            <div className="flex items-center justify-center py-16 text-white/50">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : laneList.length === 0 ? (
            <EmptyState lane={lane} />
          ) : (
            laneList.map((o) => (
              <RushOrderCard
                key={o.id}
                order={o}
                tick={tick}
                busy={busyId === o.id}
                onAdvance={() => advance(o)}
                onCancel={() => setStatus(o, "cancelado")}
              />
            ))
          )}
        </section>
      </main>

      {/* Bottom action bar: quick link to full pedidos */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[oklch(0.09_0.08_305)]/90 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Link
            to="/pedidos"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/5 py-3 text-xs font-bold text-white/90 hover:bg-white/10"
          >
            <ClipboardList className="h-4 w-4" /> Ver todos
          </Link>
          <div className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-neon-pink/15 to-neon-yellow/15 py-3 text-[11px] font-bold ring-1 ring-white/10">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-emerald-200">{kpis.delivered} entregues hoje</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- KPI tile ---------- */
function KpiTile({
  label,
  value,
  icon: Icon,
  accent,
  border,
  glow = "",
  pulse = false,
  small = false,
}: {
  label: string;
  value: string | number;
  icon: typeof Flame;
  accent: string;
  border: string;
  glow?: string;
  pulse?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-white/5 px-2.5 py-2.5 backdrop-blur",
        border,
        glow,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">{label}</span>
        <Icon className={cn("h-3.5 w-3.5", accent)} />
      </div>
      <div className={cn("mt-0.5 font-display font-black leading-tight text-white", small ? "text-lg" : "text-2xl")}>
        {value}
      </div>
      {pulse && (
        <span className="absolute right-2 top-2 flex h-2 w-2">
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", "bg-neon-yellow")} />
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", "bg-neon-yellow")} />
        </span>
      )}
    </div>
  );
}

/* ---------- Empty state ---------- */
function EmptyState({ lane }: { lane: LaneId }) {
  const copy: Record<LaneId, { title: string; desc: string; icon: typeof Flame }> = {
    novos: { title: "Nenhum pedido novo", desc: "Você vai ouvir um ping quando entrar.", icon: Flame },
    cozinha: { title: "Cozinha vazia", desc: "Aceite um novo pedido para começar.", icon: ChefHat },
    rota: { title: "Ninguém em rota", desc: "Pedidos de entrega prontos aparecem aqui.", icon: Bike },
  };
  const c = copy[lane];
  const Icon = c.icon;
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/5">
        <Icon className="h-6 w-6 text-white/50" />
      </div>
      <h3 className="mt-3 font-display text-lg font-black">{c.title}</h3>
      <p className="mt-1 text-xs text-white/50">{c.desc}</p>
    </div>
  );
}

/* ---------- Order card ---------- */
function RushOrderCard({
  order,
  tick,
  busy,
  onAdvance,
  onCancel,
}: {
  order: Order;
  tick: number;
  busy: boolean;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const min = ageMinutes(order.created_at);
  const hot = min >= 15;
  const critical = min >= 25;

  const primaryLabel: string =
    order.status === "pendente" || order.status === "pago"
      ? "Aceitar & preparar"
      : order.status === "preparando"
      ? order.mode === "entrega"
        ? "Saiu p/ entrega"
        : "Marcar entregue"
      : "Marcar entregue";

  const PrimaryIcon =
    order.status === "pendente" || order.status === "pago"
      ? ChefHat
      : order.status === "preparando"
      ? order.mode === "entrega"
        ? Bike
        : CheckCircle2
      : CheckCircle2;

  const laneAccent =
    order.status === "preparando"
      ? "from-neon-cyan/30 to-neon-cyan/5 border-neon-cyan/40"
      : order.status === "saiu_para_entrega"
      ? "from-neon-pink/30 to-neon-pink/5 border-neon-pink/40"
      : "from-neon-yellow/30 to-neon-yellow/5 border-neon-yellow/40";

  const itemsCount = order.order_items.reduce((s, i) => s + (i.quantity || 1), 0);
  const wa = digitsOnly(order.phone);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-gradient-to-br p-3 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]",
        laneAccent,
        critical && "ring-1 ring-red-500/60 shadow-[0_0_30px_-10px_theme(colors.red.500)]",
      )}
    >
      {/* header row */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
            critical
              ? "bg-red-500 text-white"
              : hot
              ? "bg-neon-yellow text-[oklch(0.13_0.08_305)]"
              : "bg-white/10 text-white/80",
          )}
        >
          <Timer className="h-3 w-3" />
          {formatAge(order.created_at, tick)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/80">
          {order.mode === "entrega" ? <Bike className="h-3 w-3" /> : <Package className="h-3 w-3" />}
          {order.mode === "entrega" ? "Entrega" : "Retirada"}
        </span>
        <span className="ml-auto font-display text-base font-black text-white">
          {brl(Number(order.total || 0))}
        </span>
      </div>

      {/* customer */}
      <div className="mt-2 min-w-0">
        <h3 className="truncate font-display text-lg font-black leading-tight">
          {firstName(order.customer_name)}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-white/60">
          {itemsCount} {itemsCount === 1 ? "item" : "itens"} •{" "}
          {order.order_items.slice(0, 2).map((i) => i.name).join(", ")}
          {order.order_items.length > 2 ? "…" : ""}
        </p>
        {order.mode === "entrega" && order.address && (
          <p className="mt-1 flex items-start gap-1 text-[11px] text-white/50">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="line-clamp-1">{order.address}</span>
          </p>
        )}
        {order.note && (
          <p className="mt-1 rounded-lg border border-neon-yellow/30 bg-neon-yellow/10 px-2 py-1 text-[11px] text-neon-yellow">
            ⚠ {order.note}
          </p>
        )}
      </div>

      {/* actions */}
      <div className="mt-3 flex items-stretch gap-2">
        <button
          type="button"
          onClick={onAdvance}
          disabled={busy}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-neon-pink to-neon-yellow px-4 text-sm font-black text-[oklch(0.13_0.08_305)] shadow-[0_10px_30px_-8px_var(--neon-pink)] transition active:scale-[0.98]",
            "min-h-[56px]",
            busy && "opacity-70",
          )}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <PrimaryIcon className="h-5 w-5" />}
          {primaryLabel}
        </button>
        {wa && (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(`Olá ${firstName(order.customer_name)}! Aqui é da Quero Bis, sobre seu pedido…`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="grid w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30"
            aria-label="WhatsApp"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="grid w-12 shrink-0 place-items-center rounded-2xl bg-white/5 text-white/60 hover:bg-red-500/20 hover:text-red-300"
          aria-label="Cancelar pedido"
        >
          ✕
        </button>
      </div>
    </article>
  );
}
