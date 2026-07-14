import { createFileRoute } from "@tanstack/react-router";
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

function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
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

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 p-3 text-white shadow-lg">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Reativação de Clientes</h1>
              <p className="text-sm text-slate-500">
                Traga de volta quem sumiu — cupom automático via WhatsApp após X dias sem pedir.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span>{settings?.enabled ? "Ativo" : "Pausado"}</span>
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
            </label>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {[
            { id: "overview", label: "Visão geral", icon: Sparkles },
            { id: "candidatos", label: "Candidatos", icon: Users },
            { id: "config", label: "Configurações", icon: Settings2 },
            { id: "historico", label: "Histórico", icon: History },
          ].map((t) => {
            const Ic = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as Tab)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
                  active ? "bg-card text-rose-500 shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Ic className="h-4 w-4" />
                {t.label}
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

/* ============================================================== */
function OverviewTab({ settings, stats }: { settings: Settings | null; stats: Record<string, number> | null }) {
  const s = settings;
  const cards = [
    { label: "Enviados no total", value: stats?.sent_total ?? 0, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Enviados (30 dias)", value: stats?.sent_30d ?? 0, tone: "bg-sky-50 text-sky-700" },
    { label: "Clientes únicos", value: stats?.unique_users ?? 0, tone: "bg-indigo-50 text-indigo-700" },
    { label: "Falhas", value: stats?.failed_total ?? 0, tone: "bg-rose-50 text-rose-700" },
    { label: "Resgataram cupom (90d)", value: stats?.redeemed_90d ?? 0, tone: "bg-amber-50 text-amber-700" },
  ];
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl p-4 ${c.tone}`}>
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">{c.label}</div>
            <div className="mt-1 text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Status da automação</h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
          <Row label="Estado" value={s?.enabled ? "🟢 Ativa" : "⏸️ Pausada"} />
          <Row label="Dias sem pedir" value={`${s?.days_inactive ?? "—"} dias`} />
          <Row label="Cooldown por cliente" value={`${s?.cooldown_days ?? "—"} dias`} />
          <Row label="Máx. por execução" value={String(s?.max_per_run ?? "—")} />
          <Row
            label="Horário do disparo"
            value={`${String(s?.send_hour ?? 10).padStart(2, "0")}:${String(s?.send_minute ?? 0).padStart(2, "0")} (${s?.timezone ?? "—"})`}
          />
          <Row
            label="Desconto padrão"
            value={
              s?.discount_type === "percent"
                ? `${s.discount_value}% OFF · válido ${s.validity_days}d`
                : s
                  ? `${BRL(s.discount_value)} OFF · válido ${s.validity_days}d`
                  : "—"
            }
          />
          <Row label="Último disparo" value={s?.last_run_at ? new Date(s.last_run_at).toLocaleString("pt-BR") : "Nunca"} />
          <Row label="Último resultado" value={s?.last_run_status ?? "—"} />
        </dl>
        {s?.last_run_error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>{s.last_run_error}</span>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Como funciona</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Um cron verifica a cada 15 min se está no horário/dia configurado.
          </li>
          <li>
            Busca clientes com <b>{s?.days_inactive ?? 30}+ dias</b> sem comprar, respeitando cooldown de{" "}
            <b>{s?.cooldown_days ?? 60}d</b> para não spammar.
          </li>
          <li>Cria cupom único de uso individual para cada cliente selecionado.</li>
          <li>Envia mensagem personalizada no WhatsApp via Evolution API.</li>
          <li>Registra tudo em Histórico — status, cupom, erros.</li>
        </ol>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

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
    if (!confirm(`Disparar para até ${settings?.max_per_run ?? 50} clientes agora?`)) return;
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Buscar por nome, e-mail ou telefone" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Dias sem comprar ≥</Label>
          <Input
            type="number"
            min={7}
            max={365}
            className="w-24"
            value={days ?? settings?.days_inactive ?? 30}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
        <Button variant="outline" onClick={() => runSelected(true)} disabled={running || !selected.size}>
          Simular {selected.size ? `(${selected.size})` : ""}
        </Button>
        <Button onClick={() => runSelected(false)} disabled={running || !selected.size} className="bg-rose-600 hover:bg-rose-700">
          <MessageCircle className="h-4 w-4" /> Enviar selecionados
        </Button>
        <Button onClick={runAll} disabled={running} className="bg-emerald-600 hover:bg-emerald-700">
          <Play className="h-4 w-4" /> Disparar agora
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => {
                    if (allSelected) setSelected(new Set());
                    else setSelected(new Set(filtered.map((r) => r.user_id)));
                  }}
                />
              </th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2 text-right">Pedidos</th>
              <th className="px-3 py-2 text-right">LTV</th>
              <th className="px-3 py-2 text-right">Sem comprar</th>
              <th className="px-3 py-2">Último WB</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  {loading ? "Carregando…" : "Nenhum candidato elegível no momento. 🎉"}
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.user_id} className="border-t border-border/60 hover:bg-muted/40">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(r.user_id)} onChange={() => toggle(r.user_id)} />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-foreground">{r.full_name || "(sem nome)"}</div>
                  <div className="text-xs text-slate-500">{r.email}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.phone || "—"}</td>
                <td className="px-3 py-2 text-right">{r.orders_count}</td>
                <td className="px-3 py-2 text-right">{BRL(r.lifetime_spent)}</td>
                <td className="px-3 py-2 text-right font-medium text-rose-600">{r.days_since_last_order}d</td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {r.last_winback_at ? new Date(r.last_winback_at).toLocaleDateString("pt-BR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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

  return (
    <div className="space-y-6">
      <Card title="Público-alvo">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Dias sem comprar (mín.)">
            <Input type="number" min={7} max={365} value={settings.days_inactive} onChange={(e) => patch({ days_inactive: Number(e.target.value) })} />
          </Field>
          <Field label="Pedidos mínimos (histórico)">
            <Input type="number" min={1} value={settings.min_orders} onChange={(e) => patch({ min_orders: Number(e.target.value) })} />
          </Field>
          <Field label="Gasto mínimo acumulado (R$)">
            <Input type="number" min={0} value={settings.min_lifetime_spent} onChange={(e) => patch({ min_lifetime_spent: Number(e.target.value) })} />
          </Field>
          <Field label="Cooldown por cliente (dias)">
            <Input type="number" min={7} max={365} value={settings.cooldown_days} onChange={(e) => patch({ cooldown_days: Number(e.target.value) })} />
          </Field>
          <Field label="Máx. de envios por execução">
            <Input type="number" min={1} max={500} value={settings.max_per_run} onChange={(e) => patch({ max_per_run: Number(e.target.value) })} />
          </Field>
          <Field label="Exigir telefone cadastrado">
            <Switch checked={settings.require_phone} onCheckedChange={(v) => patch({ require_phone: v })} />
          </Field>
        </div>
      </Card>

      <Card title="Cupom oferecido">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Prefixo do código">
            <Input maxLength={12} value={settings.coupon_prefix} onChange={(e) => patch({ coupon_prefix: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Tipo de desconto">
            <select
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={settings.discount_type}
              onChange={(e) => patch({ discount_type: e.target.value as "percent" | "fixed" })}
            >
              <option value="percent">Porcentagem (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </Field>
          <Field label={settings.discount_type === "percent" ? "Desconto (%)" : "Desconto (R$)"}>
            <Input type="number" min={1} value={settings.discount_value} onChange={(e) => patch({ discount_value: Number(e.target.value) })} />
          </Field>
          <Field label="Pedido mínimo (R$)">
            <Input type="number" min={0} value={settings.min_order} onChange={(e) => patch({ min_order: Number(e.target.value) })} />
          </Field>
          <Field label="Validade (dias)">
            <Input type="number" min={1} max={90} value={settings.validity_days} onChange={(e) => patch({ validity_days: Number(e.target.value) })} />
          </Field>
        </div>
      </Card>

      <Card title="Mensagem no WhatsApp">
        <p className="text-xs text-slate-500 mb-2">
          Variáveis: <code>{"{nome}"}</code>, <code>{"{cupom}"}</code>, <code>{"{desconto}"}</code>, <code>{"{validade}"}</code>, <code>{"{link}"}</code>
        </p>
        <Textarea rows={4} value={settings.message_template} onChange={(e) => patch({ message_template: e.target.value })} />
        <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 whitespace-pre-wrap">
          <b>Prévia:</b> {preview}
        </div>
        <Field label="Link que aparece na mensagem" className="mt-3">
          <Input value={settings.order_link_path} onChange={(e) => patch({ order_link_path: e.target.value })} />
        </Field>
      </Card>

      <Card title="Agenda do envio automático">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Horário (HH)">
            <Input type="number" min={0} max={23} value={settings.send_hour} onChange={(e) => patch({ send_hour: Number(e.target.value) })} />
          </Field>
          <Field label="Minuto (MM)">
            <Input type="number" min={0} max={59} value={settings.send_minute} onChange={(e) => patch({ send_minute: Number(e.target.value) })} />
          </Field>
          <Field label="Fuso horário">
            <Input value={settings.timezone} onChange={(e) => patch({ timezone: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4">
          <Label className="text-xs">Dias da semana</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const active = settings.weekdays.includes(d.v);
              return (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => toggleWeekday(d.v)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-rose-500 bg-rose-500 text-white"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
          <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 text-base font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ============================================================== */
function HistoryTab() {
  const [rows, setRows] = useState<SendRow[]>([]);
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold text-foreground">Últimos envios</h2>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  {loading ? "Carregando…" : "Nenhum envio ainda."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/60 align-top">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2">
                  <StatusPill status={r.status} />
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.phone || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.coupon_code || "—"}</td>
                <td className="px-3 py-2 text-xs">{r.triggered_by}</td>
                <td className="px-3 py-2 text-xs">{r.days_since_last_order ? `${r.days_since_last_order}d` : "—"}</td>
                <td className="px-3 py-2 text-xs text-rose-600 max-w-[240px] truncate" title={r.error ?? ""}>{r.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; ic: React.ElementType; l: string }> = {
    sent: { c: "bg-emerald-100 text-emerald-700", ic: CheckCircle2, l: "Enviado" },
    partial: { c: "bg-amber-100 text-amber-700", ic: AlertTriangle, l: "Parcial" },
    failed: { c: "bg-rose-100 text-rose-700", ic: XCircle, l: "Falhou" },
    skipped: { c: "bg-slate-100 text-muted-foreground", ic: AlertTriangle, l: "Ignorado" },
  };
  const meta = map[status] ?? { c: "bg-slate-100 text-muted-foreground", ic: AlertTriangle, l: status };
  const Ic = meta.ic;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.c}`}>
      <Ic className="h-3 w-3" />
      {meta.l}
    </span>
  );
}
