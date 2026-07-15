import { createFileRoute, Link } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Sparkles, Save, Play, Settings2, History, TrendingDown, TrendingUp, AlertTriangle,
  CheckCircle2, XCircle, Clock, MessageCircle, RefreshCw, Trash2, Zap,
} from "lucide-react";
import {
  getDailyInsightSettings, updateDailyInsightSettings, runDailyInsightsNow,
  listDailyInsights, updateInsightStatus, deleteInsight, getInsightStats,
} from "@/lib/daily-insights.functions";

export const Route = createFileRoute("/_authenticated/insights-diarios")({
  head: () => ({ meta: [{ title: "Copiloto Proativo — Admin" }, { name: "robots", content: "noindex" }] }),
  component: InsightsPage,
});

type Tab = "feed" | "config" | "historico";

interface Settings {
  enabled: boolean; timezone: string; send_hour: number; send_minute: number;
  weekdays: number[]; min_severity: "info" | "warning" | "critical";
  compare_window_days: number;
  category_drop_threshold: number; product_drop_threshold: number;
  revenue_drop_threshold: number; rating_drop_threshold: number;
  cart_abandon_threshold: number;
  monitor_categories: boolean; monitor_products: boolean; monitor_revenue: boolean;
  monitor_reviews: boolean; monitor_carts: boolean; monitor_new_customers: boolean;
  send_whatsapp: boolean; whatsapp_target: string | null; send_push: boolean;
  ai_tone: "coach" | "direto" | "descontraido" | "executivo";
  ai_model: string; max_insights_per_run: number;
  last_run_at?: string | null; last_run_status?: string | null;
  last_run_error?: string | null; last_run_count?: number | null;
}

interface Insight {
  id: string; kind: string; severity: "info" | "warning" | "critical";
  title: string; finding: string; hypothesis: string | null;
  suggested_action: string | null; action_kind: string | null;
  action_payload: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  status: "new" | "read" | "done" | "dismissed" | "snoozed";
  delivered_whatsapp: boolean; delivered_push: boolean; notes: string | null;
  created_at: string;
}

const WEEKDAYS = [
  { v: 0, label: "Dom" }, { v: 1, label: "Seg" }, { v: 2, label: "Ter" }, { v: 3, label: "Qua" },
  { v: 4, label: "Qui" }, { v: 5, label: "Sex" }, { v: 6, label: "Sáb" },
];

function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onCheckedChange(!checked)}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${checked ? "bg-primary" : "bg-muted"}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

const SEV_STYLE: Record<string, { bg: string; text: string; label: string; Icon: typeof AlertTriangle }> = {
  critical: { bg: "bg-rose-500/15 border border-rose-500/30", text: "text-rose-300", label: "Crítico", Icon: AlertTriangle },
  warning:  { bg: "bg-amber-500/15 border border-amber-500/30", text: "text-amber-300", label: "Atenção", Icon: TrendingDown },
  info:     { bg: "bg-sky-500/15 border border-sky-500/30",     text: "text-sky-300",   label: "Info",    Icon: TrendingUp },
};

function InsightsPage() {
  const [tab, setTab] = useState<Tab>("feed");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [stats, setStats] = useState<{ total: number; new: number; done: number; critical: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "done" | "dismissed">("new");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const _get = useServerFn(getDailyInsightSettings);
  const _upd = useServerFn(updateDailyInsightSettings);
  const _run = useServerFn(runDailyInsightsNow);
  const _list = useServerFn(listDailyInsights);
  const _status = useServerFn(updateInsightStatus);
  const _del = useServerFn(deleteInsight);
  const _stats = useServerFn(getInsightStats);

  const refresh = async () => {
    try {
      const [s, list, st] = await Promise.all([
        _get({}),
        _list({ data: { status: statusFilter, limit: 200 } }),
        _stats({}),
      ]);
      if (s) setSettings(s as Settings);
      setInsights(list as Insight[]);
      setStats(st);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [statusFilter]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const patch = { ...settings } as Partial<Settings>;
      delete (patch as { last_run_at?: unknown }).last_run_at;
      delete (patch as { last_run_status?: unknown }).last_run_status;
      delete (patch as { last_run_error?: unknown }).last_run_error;
      delete (patch as { last_run_count?: unknown }).last_run_count;
      await _upd({ data: patch });
      toast.success("Configurações salvas.");
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  const runNow = async (dryRun = false) => {
    setRunning(true);
    try {
      const out = await _run({ data: { dry_run: dryRun } });
      if (dryRun) {
        toast.success(`Prévia: ${out.preview.length} insights detectados.`);
      } else {
        toast.success(`${out.generated} insights gerados${out.delivered_whatsapp ? " e enviados no WhatsApp" : ""}.`);
      }
      if (out.aiError) toast.error(`IA: ${out.aiError}`);
      await refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setRunning(false); }
  };

  const setStatus = async (id: string, status: Insight["status"]) => {
    try { await _status({ data: { id, status } }); await refresh(); toast.success("Atualizado."); }
    catch (e) { toast.error((e as Error).message); }
  };
  const remove = async (id: string) => {
    if (!(await confirmDialog({ message: "Remover este insight?" }))) return;
    try { await _del({ data: { id } }); await refresh(); } catch (e) { toast.error((e as Error).message); }
  };

  const kpiAccent: Record<string, string> = {
    violet: "text-primary",
    sky: "text-sky-400",
    rose: "text-rose-400",
    emerald: "text-emerald-400",
  };

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Copiloto Proativo</h1>
        <p className="text-sm text-muted-foreground">Insights diários automáticos com sugestões de ação</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total gerados", value: stats?.total ?? "—", icon: Sparkles, color: "violet" },
          { label: "Novos", value: stats?.new ?? "—", icon: Zap, color: "sky" },
          { label: "Críticos abertos", value: stats?.critical ?? "—", icon: AlertTriangle, color: "rose" },
          { label: "Resolvidos", value: stats?.done ?? "—", icon: CheckCircle2, color: "emerald" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <k.icon className={`h-4 w-4 ${kpiAccent[k.color]}`} /> {k.label}
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["feed", "config", "historico"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}>
            {t === "feed" ? "Feed" : t === "config" ? "Configurações" : "Histórico"}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => runNow(true)} disabled={running}>
            <RefreshCw className={`mr-1 h-4 w-4 ${running ? "animate-spin" : ""}`} /> Prévia
          </Button>
          <Button size="sm" onClick={() => runNow(false)} disabled={running}>
            <Play className="mr-1 h-4 w-4" /> Gerar agora
          </Button>
        </div>
      </div>

      {loading && <div className="text-center text-muted-foreground py-10">Carregando…</div>}

      {!loading && tab === "feed" && (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {(["new", "all", "done", "dismissed"] as const).map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`rounded-full px-3 py-1 transition ${
                  statusFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                {f === "new" ? "Novos" : f === "all" ? "Todos" : f === "done" ? "Resolvidos" : "Descartados"}
              </button>
            ))}
          </div>

          {insights.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
              <Sparkles className="mx-auto h-10 w-10 mb-2 text-primary" />
              Nenhum insight ainda. Clique em <b>Gerar agora</b> para analisar os últimos dias.
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map((it) => {
                const s = SEV_STYLE[it.severity] ?? SEV_STYLE.info;
                return (
                  <div key={it.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className={`rounded-lg p-2 ${s.bg} ${s.text}`}><s.Icon className="h-5 w-5" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">{it.title}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>{s.label}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{it.kind}</span>
                          {it.delivered_whatsapp && <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />}
                          <span className="ml-auto text-[11px] text-muted-foreground">
                            {new Date(it.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-foreground/90">{it.finding}</p>
                        {it.hypothesis && (
                          <p className="mt-1 text-sm text-muted-foreground"><b>Hipótese:</b> {it.hypothesis}</p>
                        )}
                        {it.suggested_action && (
                          <div className="mt-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
                            <b className="text-primary">💡 Ação sugerida:</b> {it.suggested_action}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link to="/copiloto" search={{ prompt: `${it.title}. ${it.suggested_action ?? ""}` } as never}>
                            <Button size="sm" variant="outline"><Sparkles className="mr-1 h-3.5 w-3.5" /> Aplicar no Copiloto</Button>
                          </Link>
                          {it.status !== "done" && (
                            <Button size="sm" variant="outline" onClick={() => setStatus(it.id, "done")}>
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Resolvido
                            </Button>
                          )}
                          {it.status !== "dismissed" && (
                            <Button size="sm" variant="outline" onClick={() => setStatus(it.id, "dismissed")}>
                              <XCircle className="mr-1 h-3.5 w-3.5" /> Descartar
                            </Button>
                          )}
                          {it.status === "new" && (
                            <Button size="sm" variant="outline" onClick={() => setStatus(it.id, "snoozed")}>
                              <Clock className="mr-1 h-3.5 w-3.5" /> Adiar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300" onClick={() => remove(it.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {!loading && tab === "config" && settings && (
        <ConfigPanel s={settings} setS={setSettings} save={save} saving={saving} />
      )}

      {!loading && tab === "historico" && settings && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-2 text-sm text-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground"><History className="h-4 w-4" /> Última execução</div>
          <div className="text-muted-foreground">Quando: <b className="text-foreground">{settings.last_run_at ? new Date(settings.last_run_at).toLocaleString("pt-BR") : "—"}</b></div>
          <div className="text-muted-foreground">Status: <b className={settings.last_run_status === "ok" ? "text-emerald-400" : "text-rose-400"}>{settings.last_run_status ?? "—"}</b></div>
          <div className="text-muted-foreground">Insights gerados: <b className="text-foreground">{settings.last_run_count ?? 0}</b></div>
          {settings.last_run_error && (
            <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300">{settings.last_run_error}</div>
          )}
        </div>
      )}
    </AdminShell>
  );
}

function ConfigPanel({ s, setS, save, saving }: {
  s: Settings; setS: (s: Settings) => void; save: () => void; saving: boolean;
}) {
  const upd = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const toggleWd = (v: number) => {
    const set = new Set(s.weekdays); set.has(v) ? set.delete(v) : set.add(v);
    upd("weekdays", Array.from(set).sort() as number[]);
  };

  const monitors: Array<[keyof Settings, string, string]> = useMemo(() => [
    ["monitor_revenue", "Receita total", "Detectar quedas ou altas na receita comparada com a janela anterior."],
    ["monitor_categories", "Categorias", "Ex: 'Vendas de shake caíram 20%'."],
    ["monitor_products", "Produtos", "Detecta produtos em queda e produtos em alta ('best sellers do mês')."],
    ["monitor_reviews", "Avaliações", "Alerta quando a nota média cai."],
    ["monitor_carts", "Carrinhos abandonados", "Alerta quando a taxa de abandono passa do limite."],
    ["monitor_new_customers", "Novos clientes", "Detecta quedas em clientes únicos."],
  ], []);

  const selectClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2"><Settings2 className="h-4 w-4" /> Geral</h3>
        <div className="flex items-center gap-3">
          <Switch checked={s.enabled} onCheckedChange={(v) => upd("enabled", v)} />
          <div>
            <div className="text-sm font-medium text-foreground">Copiloto proativo ativo</div>
            <div className="text-xs text-muted-foreground">Executa análise automaticamente no horário configurado.</div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label>Fuso horário</Label>
            <Input value={s.timezone} onChange={(e) => upd("timezone", e.target.value)} />
          </div>
          <div>
            <Label>Hora</Label>
            <Input type="number" min={0} max={23} value={s.send_hour}
              onChange={(e) => upd("send_hour", Math.min(23, Math.max(0, Number(e.target.value) || 0)))} />
          </div>
          <div>
            <Label>Minuto</Label>
            <Input type="number" min={0} max={59} value={s.send_minute}
              onChange={(e) => upd("send_minute", Math.min(59, Math.max(0, Number(e.target.value) || 0)))} />
          </div>
          <div>
            <Label>Janela de comparação</Label>
            <Input type="number" min={1} max={60} value={s.compare_window_days}
              onChange={(e) => upd("compare_window_days", Math.min(60, Math.max(1, Number(e.target.value) || 7)))} />
          </div>
        </div>
        <div>
          <Label>Dias da semana</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {WEEKDAYS.map((d) => {
              const active = s.weekdays.includes(d.v);
              return (
                <button key={d.v} type="button" onClick={() => toggleWd(d.v)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-muted text-muted-foreground hover:text-foreground"
                  }`}>
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold text-foreground">O que monitorar</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {monitors.map(([k, label, desc]) => (
            <label key={k as string} className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-3 cursor-pointer hover:bg-muted/60 transition">
              <Switch checked={Boolean(s[k])} onCheckedChange={(v) => upd(k, v as never)} />
              <div>
                <div className="text-sm font-medium text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold text-foreground">Sensibilidade (thresholds)</h3>
        <p className="text-xs text-muted-foreground">Só gera insight quando a variação passa desses limites.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <ThresholdInput label="Queda de receita (%)" val={s.revenue_drop_threshold} onChange={(v) => upd("revenue_drop_threshold", v)} />
          <ThresholdInput label="Queda por categoria (%)" val={s.category_drop_threshold} onChange={(v) => upd("category_drop_threshold", v)} />
          <ThresholdInput label="Queda por produto (%)" val={s.product_drop_threshold} onChange={(v) => upd("product_drop_threshold", v)} />
          <ThresholdInput label="Queda na nota (pontos)" val={s.rating_drop_threshold} step={0.1} onChange={(v) => upd("rating_drop_threshold", v)} />
          <ThresholdInput label="Taxa carrinho abandonado (%)" val={s.cart_abandon_threshold} onChange={(v) => upd("cart_abandon_threshold", v)} />
          <div>
            <Label>Severidade mínima</Label>
            <select value={s.min_severity} onChange={(e) => upd("min_severity", e.target.value as Settings["min_severity"])}
              className={selectClass}>
              <option value="info">Info (mostrar tudo)</option>
              <option value="warning">Atenção</option>
              <option value="critical">Apenas críticos</option>
            </select>
          </div>
          <ThresholdInput label="Máx. insights por execução" val={s.max_insights_per_run} onChange={(v) => upd("max_insights_per_run", Math.min(20, Math.max(1, Math.round(v))))} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold text-foreground">Inteligência</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Tom das mensagens</Label>
            <select value={s.ai_tone} onChange={(e) => upd("ai_tone", e.target.value as Settings["ai_tone"])}
              className={selectClass}>
              <option value="coach">Coach (motivador)</option>
              <option value="direto">Direto ao ponto</option>
              <option value="descontraido">Descontraído</option>
              <option value="executivo">Executivo</option>
            </select>
          </div>
          <div>
            <Label>Modelo IA</Label>
            <select value={s.ai_model} onChange={(e) => upd("ai_model", e.target.value)}
              className={selectClass}>
              <option value="google/gemini-2.5-flash">Gemini 2.5 Flash (rápido)</option>
              <option value="google/gemini-2.5-pro">Gemini 2.5 Pro (mais raciocínio)</option>
              <option value="google/gemini-3.5-flash">Gemini 3.5 Flash</option>
              <option value="google/gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (barato)</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold text-foreground">Como você recebe os insights</h3>
        <label className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-3">
          <Switch checked={s.send_whatsapp} onCheckedChange={(v) => upd("send_whatsapp", v)} />
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">Enviar resumo no WhatsApp</div>
            <div className="text-xs text-muted-foreground mb-2">Um bilhete diário com o top de insights.</div>
            <Input placeholder="Número do dono (ex: 5541999999999)"
              value={s.whatsapp_target ?? ""} onChange={(e) => upd("whatsapp_target", e.target.value)} />
          </div>
        </label>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 sm:mx-0 bg-card/95 backdrop-blur border-t border-border p-3 sm:rounded-xl sm:border flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="mr-1 h-4 w-4" /> {saving ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}

function ThresholdInput({ label, val, onChange, step }: { label: string; val: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" step={step ?? 1} value={val}
        onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
