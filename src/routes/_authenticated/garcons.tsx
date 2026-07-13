import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  UserCheck,
  Plus,
  Search,
  Trophy,
  Medal,
  Award,
  Users,
  Wallet,
  Receipt,
  TrendingUp,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  X,
  Phone,
  Percent,
  KeyRound,
  Link2,
  Link2Off,
  Download,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/garcons")({
  head: () => ({
    meta: [
      { title: "Garçons — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WaitersPage,
});

type WaiterRow = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  avatar_url: string | null;
  commission_pct: number;
  active: boolean;
  hired_at: string;
  note: string | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  waiter_id: string | null;
  total: number | null;
  status: string;
  customer_name: string | null;
  created_at: string;
  mode: string | null;
  user_id: string | null;
  table_id: string | null;
};

// Um pedido é considerado "venda pelo site" quando veio do app do cliente
// (tem user_id autenticado) e não está vinculado a uma mesa do salão.
const isSiteOrder = (o: OrderRow) =>
  !!o.user_id && !o.table_id && (o.mode === "entrega" || o.mode === "retirada");


const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PCT = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

type Period = "hoje" | "semana" | "mes" | "tudo";

function periodStart(p: Period): Date {
  const d = new Date();
  if (p === "hoje") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (p === "semana") {
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (p === "mes") {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(0);
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function WaitersPage() {
  const [waiters, setWaiters] = useState<WaiterRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("mes");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<WaiterRow | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [detailWaiter, setDetailWaiter] = useState<WaiterRow | null>(null);

  const load = async () => {
    setLoading(true);
    const from = periodStart("tudo").toISOString();
    const [wRes, oRes] = await Promise.all([
      supabase.from("waiters").select("*").order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("id,waiter_id,total,status,customer_name,created_at,mode,user_id,table_id")
        .gte("created_at", from)
        .neq("status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    if (wRes.error) toast.error("Falha ao carregar garçons");
    else setWaiters((wRes.data ?? []) as WaiterRow[]);
    if (!oRes.error) setOrders((oRes.data ?? []) as OrderRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const periodOrders = useMemo(() => {
    const start = periodStart(period).getTime();
    return orders.filter((o) => new Date(o.created_at).getTime() >= start);
  }, [orders, period]);

  const stats = useMemo(() => {
    const map = new Map<
      string,
      { orders: number; revenue: number; commission: number }
    >();
    for (const w of waiters) map.set(w.id, { orders: 0, revenue: 0, commission: 0 });
    let attributed = 0;
    let attributedRevenue = 0;
    for (const o of periodOrders) {
      if (!o.waiter_id) continue;
      const w = waiters.find((x) => x.id === o.waiter_id);
      const bucket = map.get(o.waiter_id);
      if (!bucket) continue;
      const total = Number(o.total ?? 0);
      bucket.orders += 1;
      bucket.revenue += total;
      bucket.commission += total * (Number(w?.commission_pct ?? 0) / 100);
      attributed += 1;
      attributedRevenue += total;
    }
    const activeCount = waiters.filter((w) => w.active).length;
    const totalCommission = Array.from(map.values()).reduce(
      (a, b) => a + b.commission,
      0,
    );
    const avgTicket = attributed > 0 ? attributedRevenue / attributed : 0;
    const siteList = periodOrders.filter(isSiteOrder);
    const siteRevenue = siteList.reduce((a, o) => a + Number(o.total ?? 0), 0);
    const siteAvg = siteList.length > 0 ? siteRevenue / siteList.length : 0;
    // "Não atribuídos" só considera pedidos do salão (não são vendas do site)
    const unassignedSalao = periodOrders.filter(
      (o) => !o.waiter_id && !isSiteOrder(o),
    ).length;
    return {
      map,
      activeCount,
      totalWaiters: waiters.length,
      attributed,
      attributedRevenue,
      avgTicket,
      totalCommission,
      unassigned: unassignedSalao,
      siteOrders: siteList.length,
      siteRevenue,
      siteAvg,
    };
  }, [waiters, periodOrders]);

  const filteredWaiters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return waiters
      .filter((w) => {
        if (statusFilter === "active" && !w.active) return false;
        if (statusFilter === "inactive" && w.active) return false;
        if (!q) return true;
        return (
          w.name.toLowerCase().includes(q) ||
          w.code.toLowerCase().includes(q) ||
          (w.phone ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aRev = stats.map.get(a.id)?.revenue ?? 0;
        const bRev = stats.map.get(b.id)?.revenue ?? 0;
        return bRev - aRev;
      });
  }, [waiters, query, statusFilter, stats]);

  const ranking = useMemo(() => {
    return waiters
      .map((w) => ({ ...w, ...(stats.map.get(w.id) ?? { orders: 0, revenue: 0, commission: 0 }) }))
      .filter((w) => w.orders > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);
  }, [waiters, stats]);

  const toggleActive = async (w: WaiterRow) => {
    const { error } = await supabase
      .from("waiters")
      .update({ active: !w.active })
      .eq("id", w.id);
    if (error) return toast.error("Não foi possível atualizar");
    toast.success(w.active ? "Garçom desativado" : "Garçom ativado");
    load();
  };

  const remove = async (w: WaiterRow) => {
    if (!confirm(`Remover ${w.name}? As vendas atribuídas continuam nos relatórios sem vínculo.`))
      return;
    const { error } = await supabase.from("waiters").delete().eq("id", w.id);
    if (error) return toast.error("Não foi possível remover");
    toast.success("Garçom removido");
    load();
  };

  const exportCSV = () => {
    const rows = [
      ["Nome", "Código", "Telefone", "Comissão %", "Ativo", "Pedidos", "Faturamento", "Comissão a pagar"],
    ];
    for (const w of waiters) {
      const s = stats.map.get(w.id) ?? { orders: 0, revenue: 0, commission: 0 };
      rows.push([
        w.name,
        w.code,
        w.phone ?? "",
        String(w.commission_pct),
        w.active ? "sim" : "não",
        String(s.orders),
        s.revenue.toFixed(2),
        s.commission.toFixed(2),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `garcons-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const podium = ranking.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#0c031f] text-white">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neon-yellow">
              <UserCheck className="h-4 w-4" /> Equipe de salão
            </div>
            <h1 className="mt-1 text-2xl font-black md:text-3xl">
              Garçons
              <span className="ml-2 text-white/40">·</span>{" "}
              <span className="text-white/60">{stats.totalWaiters}</span>
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Gerencie o time, atribua vendas e acompanhe o ranking de faturamento por garçom.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/5">
              {(["hoje", "semana", "mes", "tudo"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition",
                    period === p
                      ? "bg-neon-pink text-white"
                      : "text-white/60 hover:text-white",
                  )}
                >
                  {p === "hoje" ? "Hoje" : p === "semana" ? "7 dias" : p === "mes" ? "Mês" : "Tudo"}
                </button>
              ))}
            </div>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              onClick={() => setAssignOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <Link2 className="h-3.5 w-3.5" /> Atribuir pedidos
              {stats.unassigned > 0 && (
                <span className="ml-1 rounded-full bg-neon-yellow px-1.5 py-0.5 text-[10px] font-black text-black">
                  {stats.unassigned}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setEditOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-neon-pink px-3 py-2 text-xs font-bold text-white shadow-lg shadow-neon-pink/20 hover:brightness-110"
            >
              <Plus className="h-3.5 w-3.5" /> Novo garçom
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPI
            label="Ativos"
            value={String(stats.activeCount)}
            hint={`${stats.totalWaiters} no total`}
            icon={Users}
            accent="pink"
          />
          <KPI
            label="Faturamento atribuído"
            value={BRL(stats.attributedRevenue)}
            hint={`${stats.attributed} pedidos`}
            icon={Receipt}
            accent="yellow"
          />
          <KPI
            label="Ticket médio"
            value={BRL(stats.avgTicket)}
            hint="por pedido atribuído"
            icon={TrendingUp}
            accent="green"
          />
          <KPI
            label="Comissão a pagar"
            value={BRL(stats.totalCommission)}
            hint="no período"
            icon={Wallet}
            accent="violet"
          />
        </div>

        {/* Podium */}
        {podium.length > 0 && (
          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-neon-pink/10 to-transparent p-5">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-neon-yellow" />
              <h2 className="text-sm font-black uppercase tracking-widest">
                Ranking do período
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {podium.map((w, idx) => {
                const medal =
                  idx === 0 ? { icon: Trophy, color: "text-neon-yellow", bg: "from-neon-yellow/25" } :
                  idx === 1 ? { icon: Medal, color: "text-slate-200", bg: "from-slate-300/25" } :
                  { icon: Award, color: "text-amber-500", bg: "from-amber-500/25" };
                const M = medal.icon;
                return (
                  <button
                    key={w.id}
                    onClick={() => setDetailWaiter(w)}
                    className={cn(
                      "group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-4 text-left transition hover:border-white/25",
                      medal.bg,
                      "to-transparent",
                    )}
                  >
                    <div className="absolute right-3 top-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
                      <M className={cn("h-4 w-4", medal.color)} /> #{idx + 1}
                    </div>
                    <div className="flex items-center gap-3">
                      <Avatar w={w} size="lg" />
                      <div className="min-w-0">
                        <div className="truncate text-base font-black">{w.name}</div>
                        <div className="text-xs text-white/50">Código {w.code}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <Stat label="Pedidos" value={String(w.orders)} />
                      <Stat label="Vendas" value={BRL(w.revenue)} highlight />
                      <Stat label="Comissão" value={BRL(w.commission)} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Full ranking table */}
        {ranking.length > 3 && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-white/80">
                Top 20
              </h3>
              <span className="text-xs text-white/40">
                {ranking.length} garçons com vendas
              </span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-[11px] uppercase tracking-widest text-white/50">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Garçom</th>
                    <th className="px-3 py-2 text-right">Pedidos</th>
                    <th className="px-3 py-2 text-right">Vendas</th>
                    <th className="px-3 py-2 text-right">Ticket médio</th>
                    <th className="px-3 py-2 text-right">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.slice(3).map((w, idx) => (
                    <tr
                      key={w.id}
                      onClick={() => setDetailWaiter(w)}
                      className="cursor-pointer border-t border-white/5 hover:bg-white/5"
                    >
                      <td className="px-3 py-2 font-bold text-white/50">
                        {idx + 4}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar w={w} />
                          <div>
                            <div className="font-semibold">{w.name}</div>
                            <div className="text-xs text-white/40">{w.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {w.orders}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-neon-yellow tabular-nums">
                        {BRL(w.revenue)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-white/70">
                        {BRL(w.orders > 0 ? w.revenue / w.orders : 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {BRL(w.commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Team grid */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/80">
              Equipe
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome, código..."
                  className="w-56 rounded-full border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs outline-none placeholder:text-white/30 focus:border-neon-pink/50"
                />
              </div>
              <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/5 text-[11px]">
                {(["all", "active", "inactive"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "px-3 py-1.5 font-semibold uppercase tracking-wider",
                      statusFilter === s
                        ? "bg-neon-pink text-white"
                        : "text-white/60 hover:text-white",
                    )}
                  >
                    {s === "all" ? "Todos" : s === "active" ? "Ativos" : "Inativos"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid animate-pulse gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : filteredWaiters.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
              <UserCheck className="h-8 w-8 text-white/30" />
              <p className="mt-3 text-sm text-white/60">
                Nenhum garçom cadastrado ainda.
              </p>
              <button
                onClick={() => {
                  setEditing(null);
                  setEditOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-neon-pink px-4 py-2 text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5" /> Cadastrar o primeiro
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredWaiters.map((w) => {
                const s = stats.map.get(w.id) ?? { orders: 0, revenue: 0, commission: 0 };
                return (
                  <div
                    key={w.id}
                    className={cn(
                      "group relative rounded-2xl border p-4 transition",
                      w.active
                        ? "border-white/10 bg-white/[0.03] hover:border-neon-pink/40"
                        : "border-white/5 bg-white/[0.01] opacity-70",
                    )}
                  >
                    <button
                      onClick={() => setDetailWaiter(w)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <Avatar w={w} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate font-bold">{w.name}</div>
                          {!w.active && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/60">
                              Inativo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/50">
                          <span className="inline-flex items-center gap-1">
                            <KeyRound className="h-3 w-3" /> {w.code}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Percent className="h-3 w-3" /> {PCT(w.commission_pct)}
                          </span>
                        </div>
                      </div>
                    </button>

                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-black/20 p-2 text-center">
                      <Stat label="Pedidos" value={String(s.orders)} compact />
                      <Stat label="Vendas" value={BRL(s.revenue)} highlight compact />
                      <Stat label="Comissão" value={BRL(s.commission)} compact />
                    </div>

                    <div className="mt-3 flex items-center gap-1.5">
                      <IconBtn
                        title={w.active ? "Desativar" : "Ativar"}
                        onClick={() => toggleActive(w)}
                      >
                        {w.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5 text-emerald-400" />}
                      </IconBtn>
                      <IconBtn
                        title="Editar"
                        onClick={() => {
                          setEditing(w);
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn title="Remover" onClick={() => remove(w)} danger>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconBtn>
                      {w.phone && (
                        <a
                          href={`https://wa.me/${w.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold hover:bg-white/10"
                        >
                          <Phone className="h-3 w-3" /> WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {editOpen && (
        <EditDialog
          waiter={editing}
          existing={waiters}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            load();
          }}
        />
      )}

      {assignOpen && (
        <AssignDialog
          waiters={waiters.filter((w) => w.active)}
          orders={periodOrders.filter((o) => !o.waiter_id).slice(0, 100)}
          onClose={() => setAssignOpen(false)}
          onSaved={() => {
            setAssignOpen(false);
            load();
          }}
        />
      )}

      {detailWaiter && (
        <DetailDialog
          waiter={detailWaiter}
          orders={periodOrders.filter((o) => o.waiter_id === detailWaiter.id)}
          stats={stats.map.get(detailWaiter.id) ?? { orders: 0, revenue: 0, commission: 0 }}
          onClose={() => setDetailWaiter(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------- Components ------------------------------- */

function KPI({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "pink" | "yellow" | "green" | "violet";
}) {
  const map = {
    pink: "from-neon-pink/25 to-neon-pink/0 text-neon-pink",
    yellow: "from-neon-yellow/25 to-neon-yellow/0 text-neon-yellow",
    green: "from-emerald-500/25 to-emerald-500/0 text-emerald-400",
    violet: "from-violet-500/25 to-violet-500/0 text-violet-300",
  }[accent];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", map)} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            {label}
          </span>
          <Icon className={cn("h-4 w-4", map.split(" ").pop())} />
        </div>
        <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
        {hint && <div className="text-[11px] text-white/45">{hint}</div>}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  compact,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <div>
      <div className={cn("text-[9px] font-bold uppercase tracking-widest text-white/45")}>
        {label}
      </div>
      <div
        className={cn(
          "font-black tabular-nums",
          compact ? "text-xs" : "text-sm",
          highlight && "text-neon-yellow",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 transition",
        danger ? "text-red-300 hover:bg-red-500/15" : "hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function Avatar({
  w,
  size = "sm",
}: {
  w: { name: string; avatar_url: string | null };
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "lg" ? "h-14 w-14 text-lg" : size === "md" ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs";
  if (w.avatar_url) {
    return (
      <img
        src={w.avatar_url}
        alt={w.name}
        className={cn("shrink-0 rounded-full object-cover ring-2 ring-white/10", dims)}
      />
    );
  }
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-neon-pink to-fuchsia-600 font-black text-white ring-2 ring-white/10",
        dims,
      )}
    >
      {initials(w.name) || "?"}
    </div>
  );
}

/* --------------------------------- Dialogs -------------------------------- */

function Dialog({
  title,
  onClose,
  children,
  width = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end md:place-items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative m-0 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#170a2e] p-5 shadow-2xl md:m-6 md:rounded-3xl",
          width,
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-black">{title}</h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditDialog({
  waiter,
  existing,
  onClose,
  onSaved,
}: {
  waiter: WaiterRow | null;
  existing: WaiterRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(waiter?.name ?? "");
  const [code, setCode] = useState(waiter?.code ?? "");
  const [phone, setPhone] = useState(waiter?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(waiter?.avatar_url ?? "");
  const [commissionPct, setCommissionPct] = useState(String(waiter?.commission_pct ?? 5));
  const [active, setActive] = useState(waiter?.active ?? true);
  const [hiredAt, setHiredAt] = useState(waiter?.hired_at ?? new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(waiter?.note ?? "");
  const [saving, setSaving] = useState(false);

  const suggestCode = () => {
    let n = 0;
    for (let i = 0; i < 40; i++) {
      const c = String(Math.floor(1000 + Math.random() * 9000));
      if (!existing.some((w) => w.code === c)) {
        setCode(c);
        return;
      }
      n++;
      if (n > 30) break;
    }
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Informe o nome");
    if (!code.trim()) return toast.error("Informe o código");
    if (existing.some((w) => w.code === code.trim() && w.id !== waiter?.id))
      return toast.error("Código já em uso");
    setSaving(true);
    const payload = {
      name: name.trim(),
      code: code.trim(),
      phone: phone.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      commission_pct: Number(commissionPct) || 0,
      active,
      hired_at: hiredAt,
      note: note.trim() || null,
    };
    const res = waiter
      ? await supabase.from("waiters").update(payload).eq("id", waiter.id)
      : await supabase.from("waiters").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(waiter ? "Garçom atualizado" : "Garçom cadastrado");
    onSaved();
  };

  return (
    <Dialog title={waiter ? "Editar garçom" : "Novo garçom"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nome completo">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. João da Silva"
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código / PIN">
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="0000"
                className={inputCls}
              />
              <button
                type="button"
                onClick={suggestCode}
                className="rounded-lg border border-white/10 bg-white/5 px-3 text-[11px] font-bold hover:bg-white/10"
              >
                Sugerir
              </button>
            </div>
          </Field>
          <Field label="Comissão (%)">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone (WhatsApp)">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 90000-0000"
              className={inputCls}
            />
          </Field>
          <Field label="Contratado em">
            <input
              type="date"
              value={hiredAt}
              onChange={(e) => setHiredAt(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Foto (URL)">
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </Field>
        <Field label="Observações">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </Field>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="accent-neon-pink"
          />
          <span>Ativo — aparece na atribuição de vendas</span>
        </label>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-neon-pink px-4 py-2 text-xs font-bold text-white shadow-lg shadow-neon-pink/20 hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-pink/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/50">
        {label}
      </div>
      {children}
    </label>
  );
}

function AssignDialog({
  waiters,
  orders,
  onClose,
  onSaved,
}: {
  waiters: WaiterRow[];
  orders: OrderRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedWaiter, setSelectedWaiter] = useState<string>(waiters[0]?.id ?? "");
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const selectedIds = Object.entries(selection).filter(([, v]) => v).map(([k]) => k);

  const assign = async () => {
    if (!selectedWaiter) return toast.error("Escolha um garçom");
    if (selectedIds.length === 0) return toast.error("Selecione pelo menos um pedido");
    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({ waiter_id: selectedWaiter })
      .in("id", selectedIds);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${selectedIds.length} pedido(s) atribuídos`);
    onSaved();
  };

  const unassignAll = async () => {
    if (selectedIds.length === 0) return toast.error("Nenhum pedido selecionado");
    if (!confirm(`Remover atribuição de ${selectedIds.length} pedido(s)?`)) return;
    const { error } = await supabase.from("orders").update({ waiter_id: null }).in("id", selectedIds);
    if (error) return toast.error(error.message);
    toast.success("Atribuição removida");
    onSaved();
  };

  return (
    <Dialog title="Atribuir pedidos a um garçom" onClose={onClose} width="max-w-2xl">
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/50">
            Garçom
          </div>
          <div className="flex flex-wrap gap-2">
            {waiters.length === 0 ? (
              <div className="text-xs text-white/50">Nenhum garçom ativo — cadastre antes.</div>
            ) : (
              waiters.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWaiter(w.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    selectedWaiter === w.id
                      ? "border-neon-pink bg-neon-pink/15 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  )}
                >
                  <Avatar w={w} /> <span>{w.name}</span>
                  <span className="text-[10px] text-white/50">({w.code})</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">
              Pedidos sem garçom no período · {orders.length}
            </div>
            <div className="text-[10px] text-white/50">
              {selectedIds.length} selecionado(s)
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
            {orders.length === 0 ? (
              <div className="p-8 text-center text-sm text-white/50">
                Todos os pedidos do período já têm garçom.
              </div>
            ) : (
              orders.map((o) => (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={!!selection[o.id]}
                    onChange={(e) =>
                      setSelection((s) => ({ ...s, [o.id]: e.target.checked }))
                    }
                    className="accent-neon-pink"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">
                        {o.customer_name || "Cliente sem nome"}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/60">
                        {o.mode || o.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/45">
                      {new Date(o.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <div className="text-sm font-black text-neon-yellow tabular-nums">
                    {BRL(Number(o.total ?? 0))}
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={unassignAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 hover:text-white"
          >
            <Link2Off className="h-3.5 w-3.5" /> Remover atribuição
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              onClick={assign}
              disabled={saving || !selectedWaiter}
              className="inline-flex items-center gap-2 rounded-full bg-neon-pink px-4 py-2 text-xs font-bold text-white shadow-lg shadow-neon-pink/20 hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Atribuindo..." : `Atribuir ${selectedIds.length || ""}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function DetailDialog({
  waiter,
  orders,
  stats,
  onClose,
}: {
  waiter: WaiterRow;
  orders: OrderRow[];
  stats: { orders: number; revenue: number; commission: number };
  onClose: () => void;
}) {
  return (
    <Dialog title={waiter.name} onClose={onClose} width="max-w-2xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <Avatar w={waiter} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-black">{waiter.name}</div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  waiter.active
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-white/10 text-white/60",
                )}
              >
                {waiter.active ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/60">
              <span className="inline-flex items-center gap-1">
                <KeyRound className="h-3 w-3" /> Código {waiter.code}
              </span>
              <span className="inline-flex items-center gap-1">
                <Percent className="h-3 w-3" /> {PCT(waiter.commission_pct)} de comissão
              </span>
              {waiter.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {waiter.phone}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Desde{" "}
                {new Date(waiter.hired_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Pedidos" value={String(stats.orders)} />
          <Stat label="Faturamento" value={BRL(stats.revenue)} highlight />
          <Stat label="Comissão" value={BRL(stats.commission)} />
        </div>

        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
            Pedidos atribuídos no período · {orders.length}
          </div>
          <div className="max-h-72 overflow-hidden overflow-y-auto rounded-2xl border border-white/10">
            {orders.length === 0 ? (
              <div className="p-6 text-center text-sm text-white/50">
                Nenhum pedido atribuído neste período.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-white/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Modo</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-white/5">
                      <td className="px-3 py-2 text-white/70">
                        {new Date(o.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2">{o.customer_name || "—"}</td>
                      <td className="px-3 py-2 text-white/60">{o.mode || o.status}</td>
                      <td className="px-3 py-2 text-right font-black text-neon-yellow tabular-nums">
                        {BRL(Number(o.total ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {waiter.note && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/50">
              Observações
            </div>
            {waiter.note}
          </div>
        )}
      </div>
    </Dialog>
  );
}
