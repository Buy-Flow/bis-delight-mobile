import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  HeartHandshake, Save, Play, Users, MessageCircle, History,
  Settings2, Sparkles, AlertTriangle, CheckCircle2, XCircle, Search, RefreshCw,
  ChevronDown, Target, Ticket, MessageSquareText, CalendarClock, TrendingUp,
  Clock, Zap, Phone, Send, Filter,
} from "lucide-react";
import {
  getWinbackSettings,
  updateWinbackSettings,
  previewWinbackCandidates,
  runWinbackNow,
  listWinbackSends,
  getWinbackStats,
} from "@/lib/winback.functions";

export const Route = createFileRoute("/_authenticated/marketing-winback")({
  head: () => ({ meta: [{ title: "Reativação de Clientes — Admin" }, { name: "robots", content: "noindex" }] }),
  component: WinbackPage,
});

/* ============================================================== */
/* Primitives                                                       */
/* ============================================================== */

function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? "bg-rose-600" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 ${className}`}
    />
  );
}

function AccordionItem({
  id,
  icon: Icon,
  title,
  subtitle,
  badge,
  right,
  defaultOpen = false,
  children,
  tone = "rose",
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  tone?: "rose" | "emerald" | "sky" | "amber" | "indigo";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tones: Record<string, string> = {
    rose: "from-rose-500/15 to-pink-500/5 text-rose-600 border-rose-500/20",
    emerald: "from-emerald-500/15 to-teal-500/5 text-emerald-600 border-emerald-500/20",
    sky: "from-sky-500/15 to-blue-500/5 text-sky-600 border-sky-500/20",
    amber: "from-amber-500/15 to-orange-500/5 text-amber-600 border-amber-500/20",
    indigo: "from-indigo-500/15 to-violet-500/5 text-indigo-600 border-indigo-500/20",
  };
  return (
    <section id={id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition hover:bg-muted/40"
        aria-expanded={open}
      >
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border bg-gradient-to-br ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{title}</h3>
            {badge}
          </div>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {right}
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && <div className="border-t border-border/60 p-4 sm:p-5">{children}</div>}
    </section>
  );
}

/* ============================================================== */
/* Constants & types                                                */
/* ============================================================== */

const WEEKDAYS = [
  { v: 0, label: "Dom" }, { v: 1, label: "Seg" }, { v: 2, label: "Ter" }, { v: 3, label: "Qua" },
  { v: 4, label: "Qui" }, { v: 5, label: "Sex" }, { v: 6, label: "Sáb" },
];

const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));

type Tab = "overview" | "candidatos" | "config" | "historico";

interface Settings {
  enabled: boolean;
  days_inactive: number;
  min_orders: number;
  min_lifetime_spent: number;
  require_phone: boolean;
  cooldown_days: number;
  max_per_run: number;
  send_hour: number;
  send_minute: number;
  timezone: string;
  weekdays: number[];
  coupon_prefix: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order: number;
  validity_days: number;
  message_template: string;
  push_title: string;
  push_body: string;
  send_whatsapp: boolean;
  send_push: boolean;
  order_link_path: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
  last_run_count: number;
}

interface Candidate {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  orders_count: number;
  lifetime_spent: number;
  last_order_at: string;
  days_since_last_order: number;
  last_winback_at: string | null;
  avg_ticket: number;
}

interface SendRow {
  id: string;
  user_id: string;
  phone: string | null;
  coupon_code: string | null;
  channel: string;
  status: string;
  error: string | null;
  message: string | null;
  triggered_by: string;
  days_since_last_order: number | null;
  created_at: string;
}

/* ============================================================== */
/* Root page                                                        */
/* ============================================================== */

function WinbackPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  const fetchSettings = useServerFn(getWinbackSettings);
  const saveSettings = useServerFn(updateWinbackSettings);
  const fetchStats = useServerFn(getWinbackStats);

  useEffect(() => {
    fetchSettings({}).then((d) => setSettings(d as Settings)).catch((e) => toast.error(e.message));
    fetchStats({}).then((d) => setStats(d)).catch(() => {});
  }, [fetchSettings, fetchStats]);

  const patch = (p: Partial<Settings>) => setSettings((s) => (s ? { ...s, ...p } : s));

  const onSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const {
        last_run_at: _a, last_run_status: _b, last_run_error: _c, last_run_count: _d,
        ...rest
      } = settings;
      void _a; void _b; void _c; void _d;
      const out = await saveSettings({ data: rest });
      setSettings(out as Settings);
      toast.success("Configurações salvas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string; short: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Visão geral", short: "Visão", icon: Sparkles },
    { id: "candidatos", label: "Candidatos", short: "Alvos", icon: Users },
    { id: "config", label: "Configurações", short: "Config", icon: Settings2 },
    { id: "historico", label: "Histórico", short: "Envios", icon: History },
  ];

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-4 sm:py-6 sm:space-y-6">
        {/* Hero */}
        <header className="relative overflow-hidden rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-transparent p-4 sm:p-6">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg sm:h-14 sm:w-14">
              <HeartHandshake className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight sm:text-2xl">Reativação de Clientes</h1>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Cupom automático via WhatsApp para quem sumiu.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Switch
                checked={!!settings?.enabled}
                onCheckedChange={async (v) => {
                  patch({ enabled: v });
                  try {
                    await saveSettings({ data: { enabled: v } });
                    toast.success(v ? "Automação ativada." : "Automação pausada.");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : String(e));
                  }
                }}
              />
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${settings?.enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                {settings?.enabled ? "● Ativo" : "○ Pausado"}
              </span>
            </div>
          </div>

          {/* Mini KPIs */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            <MiniStat icon={Send} tone="emerald" label="Enviados" value={stats?.sent_total ?? 0} />
            <MiniStat icon={Clock} tone="sky" label="30 dias" value={stats?.sent_30d ?? 0} />
            <MiniStat icon={Users} tone="indigo" label="Clientes" value={stats?.unique_users ?? 0} />
            <MiniStat icon={Ticket} tone="amber" label="Resgates 90d" value={stats?.redeemed_90d ?? 0} />
          </div>
        </header>

        {/* Tabs */}
        <nav className="sticky top-0 z-10 -mx-3 flex gap-1 overflow-x-auto bg-background/95 px-3 py-1 backdrop-blur sm:mx-0 sm:rounded-xl sm:bg-muted/50 sm:p-1">
          {tabs.map((t) => {
            const Ic = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4 ${
                  active
                    ? "bg-card text-rose-500 shadow-sm ring-1 ring-rose-500/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Ic className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
              </button>
            );
          })}
        </nav>

        {tab === "overview" && <OverviewTab settings={settings} stats={stats} />}
        {tab === "candidatos" && <CandidatesTab settings={settings} />}
        {tab === "config" && settings && (
          <ConfigTab settings={settings} patch={patch} onSave={onSave} saving={saving} />
        )}
        {tab === "historico" && <HistoryTab />}
      </div>
    </AdminShell>
  );
}

function MiniStat({
  icon: Icon, label, value, tone,
}: { icon: React.ElementType; label: string; value: number | string; tone: "emerald" | "sky" | "indigo" | "amber" | "rose" }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-500/10",
    sky: "text-sky-600 bg-sky-500/10",
    indigo: "text-indigo-600 bg-indigo-500/10",
    amber: "text-amber-600 bg-amber-500/10",
    rose: "text-rose-600 bg-rose-500/10",
  };
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-border bg-card/80 p-2.5 backdrop-blur">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-lg font-bold text-foreground">{value}</div>
      </div>
    </div>
  );
}

/* ============================================================== */
/* Overview                                                         */
/* ============================================================== */

function OverviewTab({ settings, stats }: { settings: Settings | null; stats: Record<string, number> | null }) {
  const s = settings;
  const successRate = useMemo(() => {
    const sent = stats?.sent_total ?? 0;
    const failed = stats?.failed_total ?? 0;
    const total = sent + failed;
    if (!total) return null;
    return Math.round((sent / total) * 100);
  }, [stats]);

  return (
    <div className="space-y-3">
      <AccordionItem
        id="status"
        icon={Zap}
        title="Status da automação"
        subtitle={s?.enabled ? "Rodando conforme agenda" : "Automação pausada"}
        badge={
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s?.enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
            {s?.enabled ? "ATIVO" : "PAUSADO"}
          </span>
        }
        defaultOpen
        tone="emerald"
      >
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <Row label="Dias sem pedir" value={`${s?.days_inactive ?? "—"} dias`} />
          <Row label="Cooldown" value={`${s?.cooldown_days ?? "—"} dias`} />
          <Row label="Máx. por execução" value={String(s?.max_per_run ?? "—")} />
          <Row
            label="Horário"
            value={`${String(s?.send_hour ?? 10).padStart(2, "0")}:${String(s?.send_minute ?? 0).padStart(2, "0")}`}
          />
          <Row
            label="Desconto"
            value={
              s?.discount_type === "percent"
                ? `${s.discount_value}% · ${s.validity_days}d`
                : s
                  ? `${BRL(s.discount_value)} · ${s.validity_days}d`
                  : "—"
            }
          />
          <Row label="Último disparo" value={s?.last_run_at ? new Date(s.last_run_at).toLocaleString("pt-BR") : "Nunca"} />
        </dl>
        {s?.last_run_error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-words">{s.last_run_error}</span>
          </div>
        )}
      </AccordionItem>

      <AccordionItem
        id="performance"
        icon={TrendingUp}
        title="Performance"
        subtitle={successRate !== null ? `${successRate}% de taxa de sucesso` : "Sem envios ainda"}
        tone="sky"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatBig label="Total enviado" value={stats?.sent_total ?? 0} tone="emerald" />
          <StatBig label="Últimos 30 dias" value={stats?.sent_30d ?? 0} tone="sky" />
          <StatBig label="Clientes únicos" value={stats?.unique_users ?? 0} tone="indigo" />
          <StatBig label="Falhas" value={stats?.failed_total ?? 0} tone="rose" />
          <StatBig label="Cupons resgatados" value={stats?.redeemed_90d ?? 0} tone="amber" />
          <StatBig label="Taxa de sucesso" value={successRate !== null ? `${successRate}%` : "—"} tone="emerald" />
        </div>
      </AccordionItem>

      <AccordionItem
        id="how"
        icon={Sparkles}
        title="Como funciona"
        subtitle="Fluxo automático em 5 passos"
        tone="indigo"
      >
        <ol className="space-y-3 text-sm">
          {[
            "Um cron verifica a cada 15 min se está no horário/dia configurado.",
            <>Busca clientes com <b>{s?.days_inactive ?? 30}+ dias</b> sem comprar, respeitando cooldown de <b>{s?.cooldown_days ?? 60}d</b>.</>,
            "Cria cupom único de uso individual para cada cliente selecionado.",
            "Envia mensagem personalizada no WhatsApp via Evolution API.",
            "Registra tudo em Histórico — status, cupom, erros.",
          ].map((step, i) => (
            <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rose-500/15 text-xs font-bold text-rose-600">
                {i + 1}
              </span>
              <span className="pt-1 text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </AccordionItem>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function StatBig({ label, value, tone }: { label: string; value: number | string; tone: "emerald" | "sky" | "indigo" | "amber" | "rose" }) {
  const tones: Record<string, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-600",
    sky: "from-sky-500/15 to-sky-500/0 text-sky-600",
    indigo: "from-indigo-500/15 to-indigo-500/0 text-indigo-600",
    amber: "from-amber-500/15 to-amber-500/0 text-amber-600",
    rose: "from-rose-500/15 to-rose-500/0 text-rose-600",
  };
  return (
    <div className={`rounded-xl border border-border bg-gradient-to-br p-3 ${tones[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-xl font-bold sm:text-2xl">{value}</div>
    </div>
  );
}

/* ============================================================== */
/* Candidates                                                       */
/* ============================================================== */

function CandidatesTab({ settings }: { settings: Settings | null }) {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [days, setDays] = useState<number | null>(null);

  const preview = useServerFn(previewWinbackCandidates);
  const run = useServerFn(runWinbackNow);

  const load = async () => {
    setLoading(true);
    try {
      const out = await preview({
        data: {
          days_inactive: days ?? undefined,
          limit: 200,
        },
      });
      setRows((out as { candidates: Candidate[] }).candidates);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (settings) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.days_inactive]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        (r.full_name || "").toLowerCase().includes(s) ||
        (r.email || "").toLowerCase().includes(s) ||
        (r.phone || "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.user_id));

  const totalLTV = useMemo(() => filtered.reduce((a, r) => a + Number(r.lifetime_spent || 0), 0), [filtered]);

  const runSelected = async (dryRun: boolean) => {
    const ids = Array.from(selected);
    if (!ids.length) return toast.error("Selecione ao menos um cliente.");
    setRunning(true);
    try {
      const out = await run({ data: { user_ids: ids, dry_run: dryRun } });
      const o = out as { sent: number; failed: number; skipped: number; dryRun: boolean };
      if (o.dryRun) {
        toast.info(`Simulação: ${ids.length} candidatos elegíveis.`);
      } else {
        toast.success(`Enviados: ${o.sent} · Falhas: ${o.failed} · Ignorados: ${o.skipped}`);
        await load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const runAll = async () => {
    if (!(await confirmDialog({ message: `Disparar para até ${settings?.max_per_run ?? 50} clientes agora?` }))) return;
    setRunning(true);
    try {
      const out = await run({ data: {} });
      const o = out as { sent: number; failed: number; skipped: number };
      toast.success(`Enviados: ${o.sent} · Falhas: ${o.failed} · Ignorados: ${o.skipped}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatBig label="Elegíveis" value={filtered.length} tone="rose" />
        <StatBig label="Selecionados" value={selected.size} tone="indigo" />
        <StatBig label="LTV filtrado" value={BRL(totalLTV)} tone="emerald" />
      </div>

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-h-11 pl-9"
          />
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">≥</span>
            <input
              type="number"
              min={7}
              max={365}
              className="w-14 border-0 bg-transparent p-0 text-sm font-semibold outline-none"
              value={days ?? settings?.days_inactive ?? 30}
              onChange={(e) => setDays(Number(e.target.value))}
            />
            <span className="text-muted-foreground">dias</span>
          </div>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="min-h-11">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* Actions */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Button variant="outline" onClick={() => runSelected(true)} disabled={running || !selected.size} className="min-h-11">
          Simular {selected.size ? `(${selected.size})` : ""}
        </Button>
        <Button
          onClick={() => runSelected(false)}
          disabled={running || !selected.size}
          className="min-h-11 bg-rose-600 hover:bg-rose-700"
        >
          <MessageCircle className="h-4 w-4" /> Enviar {selected.size ? `(${selected.size})` : "selecionados"}
        </Button>
        <Button onClick={runAll} disabled={running} className="min-h-11 bg-emerald-600 hover:bg-emerald-700">
          <Play className="h-4 w-4" /> Disparar agora
        </Button>
      </div>

      {/* Select all bar */}
      {filtered.length > 0 && (
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => {
              if (allSelected) setSelected(new Set());
              else setSelected(new Set(filtered.map((r) => r.user_id)));
            }}
            className="h-4 w-4"
          />
          <span className="font-medium">{allSelected ? "Desmarcar todos" : "Selecionar todos"}</span>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} elegível(is)</span>
        </label>
      )}

      {/* Mobile: card list. Desktop: table. */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {loading ? "Carregando…" : "Nenhum candidato elegível no momento. 🎉"}
        </div>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {filtered.map((r) => {
              const sel = selected.has(r.user_id);
              return (
                <li
                  key={r.user_id}
                  className={`overflow-hidden rounded-xl border transition ${
                    sel ? "border-rose-500/50 bg-rose-500/5" : "border-border bg-card"
                  }`}
                >
                  <label className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 p-3">
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => toggle(r.user_id)}
                      className="mt-1 h-5 w-5 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{r.full_name || "(sem nome)"}</div>
                      <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate font-mono">{r.phone || "sem telefone"}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-600">
                          {r.days_since_last_order}d sem pedir
                        </span>
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-600">
                          {BRL(r.lifetime_spent)}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                          {r.orders_count} pedido{r.orders_count === 1 ? "" : "s"}
                        </span>
                        {r.last_winback_at && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-600">
                            Já reativado
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Ticket</div>
                      <div className="text-sm font-bold text-foreground">{BRL(r.avg_ticket)}</div>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Telefone</th>
                  <th className="px-3 py-2 text-right">Pedidos</th>
                  <th className="px-3 py-2 text-right">LTV</th>
                  <th className="px-3 py-2 text-right">Ticket</th>
                  <th className="px-3 py-2 text-right">Sem comprar</th>
                  <th className="px-3 py-2">Último WB</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.user_id} className="border-t border-border/60 hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.user_id)}
                        onChange={() => toggle(r.user_id)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{r.full_name || "(sem nome)"}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.phone || "—"}</td>
                    <td className="px-3 py-2 text-right">{r.orders_count}</td>
                    <td className="px-3 py-2 text-right font-medium">{BRL(r.lifetime_spent)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{BRL(r.avg_ticket)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-rose-600">{r.days_since_last_order}d</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.last_winback_at ? new Date(r.last_winback_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================== */
/* Config (accordion sections)                                      */
/* ============================================================== */

function ConfigTab({
  settings, patch, onSave, saving,
}: {
  settings: Settings;
  patch: (p: Partial<Settings>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const toggleWeekday = (v: number) => {
    const set = new Set(settings.weekdays);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    patch({ weekdays: Array.from(set).sort() });
  };

  const preview = useMemo(() => {
    const desc = settings.discount_type === "percent"
      ? `${settings.discount_value}% OFF`
      : `${BRL(settings.discount_value)} OFF`;
    return settings.message_template
      .replace("{nome}", "Ana")
      .replace("{cupom}", `${settings.coupon_prefix.toUpperCase()}A7B2C`)
      .replace("{desconto}", desc)
      .replace("{validade}", `${settings.validity_days} dias`)
      .replace("{link}", "https://querobis.lovable.app/");
  }, [settings]);

  const discountLabel = settings.discount_type === "percent"
    ? `${settings.discount_value}%`
    : BRL(settings.discount_value);

  return (
    <div className="space-y-3">
      <AccordionItem
        id="target"
        icon={Target}
        title="Público-alvo"
        subtitle={`≥ ${settings.days_inactive}d sem comprar · min ${settings.min_orders} pedido(s)`}
        defaultOpen
        tone="rose"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Dias sem comprar (mín.)">
            <Input type="number" min={7} max={365} className="min-h-11" value={settings.days_inactive} onChange={(e) => patch({ days_inactive: Number(e.target.value) })} />
          </Field>
          <Field label="Pedidos mínimos (histórico)">
            <Input type="number" min={1} className="min-h-11" value={settings.min_orders} onChange={(e) => patch({ min_orders: Number(e.target.value) })} />
          </Field>
          <Field label="Gasto mínimo acumulado (R$)">
            <Input type="number" min={0} className="min-h-11" value={settings.min_lifetime_spent} onChange={(e) => patch({ min_lifetime_spent: Number(e.target.value) })} />
          </Field>
          <Field label="Cooldown por cliente (dias)">
            <Input type="number" min={7} max={365} className="min-h-11" value={settings.cooldown_days} onChange={(e) => patch({ cooldown_days: Number(e.target.value) })} />
          </Field>
          <Field label="Máx. de envios por execução">
            <Input type="number" min={1} max={500} className="min-h-11" value={settings.max_per_run} onChange={(e) => patch({ max_per_run: Number(e.target.value) })} />
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <div className="min-w-0">
              <Label className="text-xs font-semibold text-foreground">Exigir telefone cadastrado</Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Só envia se o cliente tiver WhatsApp válido</p>
            </div>
            <Switch checked={settings.require_phone} onCheckedChange={(v) => patch({ require_phone: v })} />
          </div>
        </div>
      </AccordionItem>

      <AccordionItem
        id="coupon"
        icon={Ticket}
        title="Cupom oferecido"
        subtitle={`${discountLabel} OFF · válido ${settings.validity_days} dias · mín ${BRL(settings.min_order)}`}
        tone="amber"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Prefixo do código">
            <Input maxLength={12} className="min-h-11 font-mono uppercase" value={settings.coupon_prefix} onChange={(e) => patch({ coupon_prefix: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Tipo de desconto">
            <select
              className="min-h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={settings.discount_type}
              onChange={(e) => patch({ discount_type: e.target.value as "percent" | "fixed" })}
            >
              <option value="percent">Porcentagem (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </Field>
          <Field label={settings.discount_type === "percent" ? "Desconto (%)" : "Desconto (R$)"}>
            <Input type="number" min={1} className="min-h-11" value={settings.discount_value} onChange={(e) => patch({ discount_value: Number(e.target.value) })} />
          </Field>
          <Field label="Pedido mínimo (R$)">
            <Input type="number" min={0} className="min-h-11" value={settings.min_order} onChange={(e) => patch({ min_order: Number(e.target.value) })} />
          </Field>
          <Field label="Validade (dias)">
            <Input type="number" min={1} max={90} className="min-h-11" value={settings.validity_days} onChange={(e) => patch({ validity_days: Number(e.target.value) })} />
          </Field>
          <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Exemplo de código</div>
            <div className="mt-1 font-mono text-sm font-bold text-foreground">
              {settings.coupon_prefix.toUpperCase()}A7B2C
            </div>
          </div>
        </div>
      </AccordionItem>

      <AccordionItem
        id="message"
        icon={MessageSquareText}
        title="Mensagem no WhatsApp"
        subtitle="Personalize com variáveis e veja o preview"
        tone="emerald"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              Variáveis:{" "}
              {["{nome}", "{cupom}", "{desconto}", "{validade}", "{link}"].map((v) => (
                <code key={v} className="mr-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{v}</code>
              ))}
            </p>
            <Textarea rows={8} value={settings.message_template} onChange={(e) => patch({ message_template: e.target.value })} />
            <Field label="Link que aparece na mensagem" className="mt-3">
              <Input className="min-h-11" value={settings.order_link_path} onChange={(e) => patch({ order_link_path: e.target.value })} />
            </Field>
          </div>

          {/* WhatsApp-style preview */}
          <div className="rounded-2xl bg-[#0b141a] p-3 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/80">Preview WhatsApp</div>
            <div className="mt-2 max-w-[90%] rounded-2xl rounded-tl-sm bg-[#005c4b] p-3 text-sm text-white shadow">
              <div className="whitespace-pre-wrap break-words leading-relaxed">{preview}</div>
              <div className="mt-1 text-right text-[10px] text-emerald-100/70">agora ✓✓</div>
            </div>
          </div>
        </div>
      </AccordionItem>

      <AccordionItem
        id="schedule"
        icon={CalendarClock}
        title="Agenda do envio automático"
        subtitle={`${String(settings.send_hour).padStart(2, "0")}:${String(settings.send_minute).padStart(2, "0")} · ${settings.weekdays.length} dia(s)/semana`}
        tone="sky"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Hora (HH)">
            <Input type="number" min={0} max={23} className="min-h-11" value={settings.send_hour} onChange={(e) => patch({ send_hour: Number(e.target.value) })} />
          </Field>
          <Field label="Minuto (MM)">
            <Input type="number" min={0} max={59} className="min-h-11" value={settings.send_minute} onChange={(e) => patch({ send_minute: Number(e.target.value) })} />
          </Field>
          <Field label="Fuso horário" className="col-span-2 sm:col-span-1">
            <Input className="min-h-11" value={settings.timezone} onChange={(e) => patch({ timezone: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4">
          <Label className="text-xs font-semibold text-foreground">Dias da semana</Label>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => {
              const active = settings.weekdays.includes(d.v);
              return (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => toggleWeekday(d.v)}
                  className={`min-h-11 rounded-lg border text-xs font-semibold transition ${
                    active
                      ? "border-rose-500 bg-rose-500 text-white shadow"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      </AccordionItem>

      {/* Sticky save */}
      <div className="sticky bottom-3 z-10 flex justify-end pt-2">
        <Button
          onClick={onSave}
          disabled={saving}
          className="min-h-12 w-full bg-rose-600 shadow-lg hover:bg-rose-700 sm:w-auto"
        >
          <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ============================================================== */
/* History                                                          */
/* ============================================================== */

function HistoryTab() {
  const [rows, setRows] = useState<SendRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const list = useServerFn(listWinbackSends);

  const load = async () => {
    setLoading(true);
    try {
      const out = await list({ data: { limit: 200 } });
      setRows(out as SendRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, sent: 0, failed: 0, skipped: 0, partial: 0 };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filters = [
    { id: "all", label: "Todos" },
    { id: "sent", label: "Enviados" },
    { id: "failed", label: "Falhas" },
    { id: "skipped", label: "Ignorados" },
    { id: "partial", label: "Parciais" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const active = statusFilter === f.id;
            const n = counts[f.id] ?? 0;
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${
                  active
                    ? "border-rose-500 bg-rose-500 text-white"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/40"
                }`}
              >
                {f.label} <span className="ml-1 opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="min-h-9">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {loading ? "Carregando…" : "Nenhum envio ainda."}
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((r) => (
              <li key={r.id} className="overflow-hidden rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusPill status={r.status} />
                      <span className="truncate text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Telefone</div>
                        <div className="truncate font-mono">{r.phone || "—"}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Cupom</div>
                        <div className="truncate font-mono">{r.coupon_code || "—"}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Origem</div>
                        <div className="truncate">{r.triggered_by}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Inativo</div>
                        <div>{r.days_since_last_order ? `${r.days_since_last_order}d` : "—"}</div>
                      </div>
                    </div>
                    {r.error && (
                      <div className="mt-2 rounded-md bg-rose-500/10 p-2 text-[11px] text-rose-600 break-words">
                        {r.error}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Quando</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Telefone</th>
                  <th className="px-3 py-2">Cupom</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">Sem comprar</th>
                  <th className="px-3 py-2">Erro</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                    <td className="px-3 py-2 font-mono text-xs">{r.phone || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.coupon_code || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.triggered_by}</td>
                    <td className="px-3 py-2 text-xs">{r.days_since_last_order ? `${r.days_since_last_order}d` : "—"}</td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-xs text-rose-600" title={r.error ?? ""}>{r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; ic: React.ElementType; l: string }> = {
    sent: { c: "bg-emerald-500/15 text-emerald-600", ic: CheckCircle2, l: "Enviado" },
    partial: { c: "bg-amber-500/15 text-amber-600", ic: AlertTriangle, l: "Parcial" },
    failed: { c: "bg-rose-500/15 text-rose-600", ic: XCircle, l: "Falhou" },
    skipped: { c: "bg-muted/60 text-muted-foreground", ic: AlertTriangle, l: "Ignorado" },
  };
  const meta = map[status] ?? { c: "bg-muted/60 text-muted-foreground", ic: AlertTriangle, l: status };
  const Ic = meta.ic;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.c}`}>
      <Ic className="h-3 w-3" />
      {meta.l}
    </span>
  );
}
