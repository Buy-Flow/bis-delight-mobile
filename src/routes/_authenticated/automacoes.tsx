import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Zap,
  Power,
  Plus,
  Activity,
  Users,
  Clock,
  Cake,
  Moon,
  UserPlus,
  Sparkles,
  CreditCard,
  Star,
  Trophy,
  CalendarDays,
  ShoppingCart,
  Bell,
  Package,
  Boxes,
  Utensils,
  Gift,
  Receipt,
  Radio,
  RefreshCw,
  Pencil,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Database,
  Timer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/automacoes")({
  head: () => ({
    meta: [
      { title: "Automações — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AutomacoesPage,
});

// ─────────────────────────────────────────────────────────────────────────────

type AutoKind =
  | "birthday"
  | "dormant"
  | "welcome"
  | "after_order"
  | "abandoned_cart"
  | "payment_pending"
  | "feedback_request"
  | "loyalty_close"
  | "weekly_promo";

interface Automation {
  id: string;
  kind: AutoKind;
  name: string | null;
  title: string;
  body: string;
  url: string | null;
  image: string | null;
  active: boolean;
  config: Record<string, any>;
  filters: Record<string, any>;
  last_run_at: string | null;
  created_at: string;
}

interface RunRow {
  id: string;
  automation_id: string;
  user_id: string;
  run_key: string;
  created_at: string;
}

const KIND_META: Record<AutoKind, { label: string; icon: typeof Zap; tint: string; ring: string }> = {
  birthday: { label: "Aniversário", icon: Cake, tint: "from-amber-500/25 to-amber-500/5", ring: "ring-amber-400/30" },
  welcome: { label: "Boas-vindas", icon: UserPlus, tint: "from-pink-500/25 to-pink-500/5", ring: "ring-pink-400/30" },
  after_order: { label: "Após pedido", icon: Sparkles, tint: "from-cyan-500/25 to-cyan-500/5", ring: "ring-cyan-400/30" },
  dormant: { label: "Cliente inativo", icon: Moon, tint: "from-indigo-500/25 to-indigo-500/5", ring: "ring-indigo-400/30" },
  abandoned_cart: { label: "Carrinho abandonado", icon: ShoppingCart, tint: "from-rose-500/25 to-rose-500/5", ring: "ring-rose-400/30" },
  payment_pending: { label: "Pagamento pendente", icon: CreditCard, tint: "from-yellow-500/25 to-yellow-500/5", ring: "ring-yellow-400/30" },
  feedback_request: { label: "Pedir avaliação", icon: Star, tint: "from-teal-500/25 to-teal-500/5", ring: "ring-teal-400/30" },
  loyalty_close: { label: "Perto da recompensa", icon: Trophy, tint: "from-orange-500/25 to-orange-500/5", ring: "ring-orange-400/30" },
  weekly_promo: { label: "Promoção semanal", icon: CalendarDays, tint: "from-fuchsia-500/25 to-fuchsia-500/5", ring: "ring-fuchsia-400/30" },
};

function summarizeConfig(kind: AutoKind, cfg: any, filters: any): string {
  const parts: string[] = [];
  if (kind === "birthday") {
    const off = Number(cfg?.days_offset ?? 0);
    parts.push(off === 0 ? "no dia" : off > 0 ? `${off}d depois` : `${Math.abs(off)}d antes`);
    parts.push(`às ${String(cfg?.hour ?? 9).padStart(2, "0")}h`);
  } else if (kind === "welcome" || kind === "after_order") {
    const m = Number(cfg?.delay_minutes ?? 0);
    parts.push(m >= 60 ? `${Math.round(m / 60)}h depois` : `${m} min depois`);
    if (kind === "after_order" && cfg?.only_first) parts.push("só 1º pedido");
  } else if (kind === "dormant") {
    parts.push(`${cfg?.days ?? 30} dias sem pedir`);
    if (Number(cfg?.repeat_days ?? 0) > 0) parts.push(`repete a cada ${cfg.repeat_days}d`);
  } else if (kind === "abandoned_cart") {
    parts.push(`${Number(cfg?.delay_minutes ?? 15)} min após abandono`);
  } else if (kind === "payment_pending") {
    parts.push(`${Number(cfg?.delay_minutes ?? 20)} min pendente`);
  } else if (kind === "feedback_request") {
    parts.push(`${Number(cfg?.delay_hours ?? 24)}h após entregue`);
  } else if (kind === "loyalty_close") {
    parts.push(`${Number(cfg?.min_stamps ?? 7)}+ selos`);
    if (cfg?.repeat_weekly) parts.push("semanal");
  } else if (kind === "weekly_promo") {
    const dowNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    parts.push(`toda ${dowNames[Number(cfg?.dow ?? 5)]} às ${String(cfg?.hour ?? 18).padStart(2, "0")}h`);
  }
  const f: string[] = [];
  if (filters?.min_orders) f.push(`≥${filters.min_orders} pedidos`);
  if (filters?.min_spent_total) f.push(`gastou R$${filters.min_spent_total}+`);
  return [parts.join(" · "), f.length ? `filtro: ${f.join(", ")}` : ""].filter(Boolean).join(" — ");
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

// System / built-in automations (documentation cards, always-on triggers)
const SYSTEM_AUTOMATIONS: Array<{
  id: string;
  icon: typeof Zap;
  title: string;
  desc: string;
  trigger: string;
  tint: string;
  status: "active" | "info";
}> = [
  {
    id: "new_order_alert",
    icon: Bell,
    title: "Alerta de novo pedido para o admin",
    desc: "Assim que um pedido é criado, dispara push imediato para todos os admins e envia WhatsApp para o número da loja.",
    trigger: "Trigger DB · orders INSERT",
    tint: "from-fuchsia-500/25 to-fuchsia-500/5",
    status: "active",
  },
  {
    id: "loyalty_stamps",
    icon: Trophy,
    title: "Selos de fidelidade automáticos",
    desc: "Ao pagar, o cliente ganha selos conforme o tier (Bronze 1, Prata 2, Ouro 3). Bônus no mês do aniversário. Aos 10 selos, gera cupom.",
    trigger: "Trigger DB · orders → status = pago",
    tint: "from-amber-500/25 to-amber-500/5",
    status: "active",
  },
  {
    id: "stock_decrement",
    icon: Boxes,
    title: "Baixa automática de estoque",
    desc: "Ao marcar pedido como pago, subtrai a quantidade vendida do estoque de cada produto.",
    trigger: "Trigger DB · orders → status = pago",
    tint: "from-emerald-500/25 to-emerald-500/5",
    status: "active",
  },
  {
    id: "ingredient_consumption",
    icon: Utensils,
    title: "Consumo de ingredientes por ficha técnica",
    desc: "Ao pagar, calcula quantidade × ficha técnica × desperdício e gera movimento de saída em cada insumo.",
    trigger: "Trigger DB · orders → status = pago",
    tint: "from-teal-500/25 to-teal-500/5",
    status: "active",
  },
  {
    id: "table_release",
    icon: Utensils,
    title: "Liberação de mesa ao finalizar",
    desc: "Quando o pedido de uma mesa vira pago/entregue/cancelado, a mesa volta a status 'limpeza' automaticamente.",
    trigger: "Trigger DB · orders status change",
    tint: "from-indigo-500/25 to-indigo-500/5",
    status: "active",
  },
  {
    id: "birthday_gift",
    icon: Gift,
    title: "Brinde de aniversário mensal",
    desc: "Clientes com aniversário no mês corrente veem um brinde disponível para reivindicar (cupom R$ 15 off, pedido mín. R$ 25).",
    trigger: "Sob demanda · claim_birthday_gift()",
    tint: "from-pink-500/25 to-pink-500/5",
    status: "active",
  },
  {
    id: "review_prompt",
    icon: Star,
    title: "Pop-up de avaliação pós-entrega",
    desc: "8 segundos após a página carregar, se houver pedidos entregues não avaliados, mostra o pop-up de estrelas linkando para a avaliação completa.",
    trigger: "Cliente · ReviewPromptPopup",
    tint: "from-yellow-500/25 to-yellow-500/5",
    status: "active",
  },
  {
    id: "order_status_stamps",
    icon: Receipt,
    title: "Marcação de horários por status",
    desc: "Cada mudança de status do pedido (pago, preparando, saiu para entrega, entregue, cancelado) grava o timestamp correspondente automaticamente.",
    trigger: "Trigger DB · orders BEFORE UPDATE",
    tint: "from-sky-500/25 to-sky-500/5",
    status: "active",
  },
];

// ─────────────────────────────────────────────────────────────────────────────

function AutomacoesPage() {
  const [items, setItems] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email?: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<AutoKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");

  const refresh = async () => {
    setLoading(true);
    const [{ data: autos }, { data: runsData }] = await Promise.all([
      supabase.from("push_automations").select("*").order("created_at", { ascending: false }),
      supabase.from("automation_runs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setItems((autos ?? []) as Automation[]);
    setRuns((runsData ?? []) as RunRow[]);

    const uids = Array.from(new Set((runsData ?? []).map((r: any) => r.user_id)));
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", uids);
      const map: Record<string, any> = {};
      (profs ?? []).forEach((p: any) => (map[p.id] = { full_name: p.full_name }));
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((a) => a.active).length;
    const paused = total - active;
    const now = Date.now();
    const runs24h = runs.filter((r) => now - new Date(r.created_at).getTime() < 86400_000).length;
    const runs7d = runs.filter((r) => now - new Date(r.created_at).getTime() < 7 * 86400_000).length;
    const reachedUsers = new Set(runs.map((r) => r.user_id)).size;
    return { total, active, paused, runs24h, runs7d, reachedUsers };
  }, [items, runs]);

  const runsByAutomation = useMemo(() => {
    const map = new Map<string, number>();
    runs.forEach((r) => map.set(r.automation_id, (map.get(r.automation_id) ?? 0) + 1));
    return map;
  }, [runs]);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (kindFilter !== "all" && a.kind !== kindFilter) return false;
      if (statusFilter === "active" && !a.active) return false;
      if (statusFilter === "paused" && a.active) return false;
      return true;
    });
  }, [items, kindFilter, statusFilter]);

  const toggleActive = async (a: Automation) => {
    setBusy(a.id);
    const { error } = await supabase.from("push_automations").update({ active: !a.active }).eq("id", a.id);
    setBusy(null);
    if (error) return toast.error("Erro ao alternar: " + error.message);
    toast.success(a.active ? "Automação pausada" : "Automação ativada");
    refresh();
  };

  const pauseAll = async () => {
    if (!confirm("Pausar TODAS as automações? Nenhum disparo automático acontecerá até você reativar.")) return;
    const { error } = await supabase.from("push_automations").update({ active: false }).eq("active", true);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Todas as automações foram pausadas");
    refresh();
  };

  const resumeAll = async () => {
    const { error } = await supabase.from("push_automations").update({ active: true }).eq("active", false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Todas as automações reativadas");
    refresh();
  };

  const runNow = async () => {
    setBusy("__run__");
    const { data, error } = await supabase.functions.invoke("run-notifications", { body: {} });
    setBusy(null);
    if (error) return toast.error("Falhou: " + error.message);
    toast.success(`Ciclo executado${data?.sent ? ` — ${data.sent} envios` : ""}`);
    setTimeout(refresh, 800);
  };

  const kindOptions: Array<AutoKind> = Object.keys(KIND_META) as AutoKind[];

  return (
    <div className="min-h-screen bg-[#0c031f] pb-16">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0c031f]/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white sm:text-2xl">Automações</h1>
              <p className="text-xs text-white/50 sm:text-sm">
                Toda a inteligência do site que roda sozinha — em um só lugar.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={runNow}
              disabled={busy === "__run__"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", busy === "__run__" && "animate-spin")} /> Rodar agora
            </button>
            {stats.active > 0 ? (
              <button
                onClick={pauseAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
              >
                <Power className="h-3.5 w-3.5" /> Pausar todas
              </button>
            ) : stats.paused > 0 ? (
              <button
                onClick={resumeAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
              >
                <Power className="h-3.5 w-3.5" /> Ativar todas
              </button>
            ) : null}
            <Link
              to="/notificacoes"
              className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-500 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-fuchsia-500/20 hover:brightness-110"
            >
              <Plus className="h-3.5 w-3.5" /> Nova automação
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi icon={Zap} label="Total" value={stats.total} tint="from-slate-500/20 to-slate-500/5" />
          <Kpi icon={CheckCircle2} label="Ativas" value={stats.active} tint="from-emerald-500/20 to-emerald-500/5" />
          <Kpi icon={AlertCircle} label="Pausadas" value={stats.paused} tint="from-rose-500/20 to-rose-500/5" />
          <Kpi icon={Activity} label="Envios 24h" value={stats.runs24h} tint="from-fuchsia-500/20 to-fuchsia-500/5" />
          <Kpi icon={Timer} label="Envios 7d" value={stats.runs7d} tint="from-cyan-500/20 to-cyan-500/5" />
          <Kpi icon={Users} label="Pessoas" value={stats.reachedUsers} tint="from-amber-500/20 to-amber-500/5" />
        </div>

        {/* Cron badge */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-[#170a2e] p-3 text-xs text-white/60">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-300">
            <Radio className="h-3 w-3 animate-pulse" /> Cron ativo
          </span>
          <span>
            O motor de disparo roda a cada <b className="text-white/80">5 minutos</b> e avalia todas as automações ativas conforme suas regras de tempo, público e filtros. Fuso horário: America/Sao_Paulo.
          </span>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <FilterPill active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
            Todas ({stats.total})
          </FilterPill>
          <FilterPill active={statusFilter === "active"} onClick={() => setStatusFilter("active")}>
            Ativas ({stats.active})
          </FilterPill>
          <FilterPill active={statusFilter === "paused"} onClick={() => setStatusFilter("paused")}>
            Pausadas ({stats.paused})
          </FilterPill>
          <div className="mx-1 h-4 w-px bg-white/10" />
          <FilterPill active={kindFilter === "all"} onClick={() => setKindFilter("all")}>
            Todos os tipos
          </FilterPill>
          {kindOptions.map((k) => {
            const Icon = KIND_META[k].icon;
            const count = items.filter((a) => a.kind === k).length;
            if (!count) return null;
            return (
              <FilterPill key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
                <Icon className="h-3 w-3" /> {KIND_META[k].label} ({count})
              </FilterPill>
            );
          })}
        </div>

        {/* Push automations list */}
        <section className="mt-6">
          <SectionTitle icon={Bell} title="Automações de notificação" subtitle="Push disparados por comportamento" />
          {loading ? (
            <div className="mt-4 rounded-xl border border-white/5 bg-[#170a2e] p-8 text-center text-sm text-white/50">
              Carregando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-[#170a2e]/40 p-10 text-center">
              <Zap className="mx-auto h-8 w-8 text-white/30" />
              <p className="mt-3 text-sm text-white/60">Nenhuma automação {statusFilter !== "all" ? statusFilter === "active" ? "ativa" : "pausada" : ""} por aqui.</p>
              <Link to="/notificacoes" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-500 px-3 py-2 text-xs font-semibold text-white hover:bg-fuchsia-400">
                <Plus className="h-3.5 w-3.5" /> Criar primeira automação
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((a) => {
                const meta = KIND_META[a.kind];
                const Icon = meta.icon;
                const runCount = runsByAutomation.get(a.id) ?? 0;
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "group relative overflow-hidden rounded-2xl border bg-[#170a2e] p-4 transition",
                      a.active ? "border-white/10" : "border-white/5 opacity-60",
                    )}
                  >
                    <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b", meta.tint)} />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={cn("grid h-10 w-10 place-items-center rounded-xl bg-white/5 ring-1", meta.ring)}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
                              {meta.label}
                            </span>
                            {a.active ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                                <span className="h-1 w-1 rounded-full bg-emerald-300" /> ativa
                              </span>
                            ) : (
                              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/50">
                                pausada
                              </span>
                            )}
                          </div>
                          <h3 className="mt-0.5 truncate text-sm font-semibold text-white">
                            {a.name || a.title}
                          </h3>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleActive(a)}
                        disabled={busy === a.id}
                        className={cn(
                          "relative h-6 w-11 shrink-0 rounded-full transition",
                          a.active ? "bg-emerald-500" : "bg-white/15",
                        )}
                        aria-label={a.active ? "Pausar" : "Ativar"}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                            a.active ? "left-[22px]" : "left-0.5",
                          )}
                        />
                      </button>
                    </div>

                    <p className="relative mt-3 line-clamp-2 text-xs text-white/60">{a.body}</p>

                    <div className="relative mt-3 flex flex-wrap items-center gap-2 text-[10px] text-white/50">
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5">
                        <Clock className="h-2.5 w-2.5" /> {summarizeConfig(a.kind, a.config, a.filters) || "sem regra"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5">
                        <Activity className="h-2.5 w-2.5" /> {runCount} envio{runCount === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5">
                        <RefreshCw className="h-2.5 w-2.5" /> último: {fmtRelative(a.last_run_at)}
                      </span>
                    </div>

                    <div className="relative mt-3 flex items-center justify-end">
                      <Link
                        to="/notificacoes"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/80 hover:bg-white/10"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* System automations */}
          <section className="lg:col-span-2">
            <SectionTitle
              icon={Database}
              title="Automações do sistema"
              subtitle="Regras internas que rodam sem configuração"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {SYSTEM_AUTOMATIONS.map((s) => (
                <div
                  key={s.id}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#170a2e] p-4"
                >
                  <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b", s.tint)} />
                  <div className="relative flex items-start gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10">
                      <s.icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-white">{s.title}</h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                          <span className="h-1 w-1 rounded-full bg-emerald-300" /> ativa
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/60">{s.desc}</p>
                      <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/50">
                        <Zap className="h-2.5 w-2.5" /> {s.trigger}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent runs */}
          <section>
            <SectionTitle
              icon={Activity}
              title="Últimos disparos"
              subtitle={`${runs.length} eventos recentes`}
            />
            <div className="mt-4 max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-[#170a2e]">
              {runs.length === 0 ? (
                <div className="p-6 text-center text-xs text-white/40">Nenhum disparo registrado ainda.</div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {runs.slice(0, 30).map((r) => {
                    const auto = items.find((a) => a.id === r.automation_id);
                    const meta = auto ? KIND_META[auto.kind] : null;
                    const Icon = meta?.icon ?? Zap;
                    const profile = profiles[r.user_id];
                    return (
                      <li key={r.id} className="flex items-start gap-3 p-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10">
                          <Icon className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-medium text-white">
                              {auto?.name || auto?.title || meta?.label || "Automação"}
                            </p>
                            <span className="shrink-0 text-[10px] text-white/40">{fmtRelative(r.created_at)}</span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-white/50">
                            → {profile?.full_name || `Cliente ${r.user_id.slice(0, 6)}`}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Kpi({ icon: Icon, label, value, tint }: { icon: typeof Zap; label: string; value: number; tint: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-white/10 bg-[#170a2e] p-3")}>
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b", tint)} />
      <div className="relative flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-white/70" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">{label}</span>
      </div>
      <div className="relative mt-1.5 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
        active
          ? "border-white/30 bg-white/10 text-white"
          : "border-white/10 bg-white/5 text-white/60 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Zap;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-white/60" />
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <span className="text-xs text-white/40">· {subtitle}</span>
    </div>
  );
}
