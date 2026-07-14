import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Stethoscope,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Webhook,
  Send,
  Loader2,
  Activity,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { runWhatsappDiagnostics } from "@/lib/whatsapp.functions";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/whatsapp-diagnostico")({
  head: () => ({
    meta: [{ title: "Diagnóstico WhatsApp — Admin" }],
  }),
  component: WhatsappDiagPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Report = any;

function StatusPill({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  const color = ok
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : warn
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-rose-500/15 text-rose-400 border-rose-500/30";
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", color)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      {children}
    </div>
  );
}

function stateLabel(state: string): { label: string; ok: boolean; warn?: boolean } {
  switch (state) {
    case "open":
      return { label: "Conectado", ok: true };
    case "connecting":
      return { label: "Aguardando QR", ok: false, warn: true };
    case "close":
      return { label: "Desconectado", ok: false };
    case "unconfigured":
      return { label: "Não configurado", ok: false };
    case "not_found":
      return { label: "Instância não existe", ok: false };
    default:
      return { label: state || "Desconhecido", ok: false, warn: true };
  }
}

function WhatsappDiagPage() {
  const runDiag = useServerFn(runWhatsappDiagnostics);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await runDiag();
      setReport(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao rodar diagnóstico");
    } finally {
      setLoading(false);
    }
  }, [runDiag]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const conn = report?.connection;
  const cfg = report?.config;
  const wh = report?.webhook;
  const m = report?.metrics24h;
  const state = conn ? stateLabel(conn.state) : null;

  return (
    <AdminShell>
    <div className="space-y-6 p-4 md:p-6">

      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Stethoscope className="h-6 w-6 text-primary" />
            Diagnóstico WhatsApp
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado da conexão Evolution, webhook, taxa de entrega e falhas em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
              autoRefresh
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <Activity className="h-4 w-4" />
            {autoRefresh ? "Auto 15s: ON" : "Auto 15s: OFF"}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Rodar diagnóstico
          </button>
        </div>
      </header>

      {!report && loading && (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analisando…
        </div>
      )}

      {report && (
        <>
          {/* Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card title="Configuração" icon={CheckCircle2}>
              <div className="flex flex-wrap gap-2">
                <StatusPill ok={!!cfg?.hasBase} label="URL" />
                <StatusPill ok={!!cfg?.hasKey} label="API Key" />
                <StatusPill ok={!!cfg?.hasInstance} label="Instância" />
                <StatusPill ok={!!cfg?.hasToken} label="Webhook Token" />
              </div>
              {cfg?.instance && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Instância: <span className="font-mono text-foreground">{cfg.instance}</span>
                </p>
              )}
            </Card>

            <Card title="Conexão Evolution" icon={conn?.state === "open" ? Wifi : WifiOff}>
              {state && <StatusPill ok={state.ok} warn={state.warn} label={state.label} />}
              {conn?.profileName && (
                <p className="mt-3 text-sm text-foreground">👤 {conn.profileName}</p>
              )}
              {conn?.ownerJid && (
                <p className="text-xs text-muted-foreground font-mono">{conn.ownerJid}</p>
              )}
              {conn?.disconnectionAt && (
                <p className="mt-2 text-xs text-rose-400">
                  Última desconexão: {new Date(conn.disconnectionAt).toLocaleString("pt-BR")}
                  {conn.disconnectionCode ? ` (código ${conn.disconnectionCode})` : ""}
                </p>
              )}
              {conn?.error && <p className="mt-2 text-xs text-rose-400">{conn.error}</p>}
            </Card>

            <Card title="Webhook" icon={Webhook}>
              <StatusPill
                ok={!!wh?.configured}
                warn={!!wh?.current && !wh?.configured}
                label={
                  wh?.configured
                    ? "Configurado"
                    : wh?.current
                      ? "URL divergente"
                      : "Não configurado"
                }
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                  (wh?.count24h ?? 0) > 0
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-400",
                )}>
                  <Activity className="h-3 w-3" />
                  {wh?.count24h ?? 0} eventos/24h
                </span>
                {wh?.lastEventAt ? (
                  <span className="text-muted-foreground">
                    último: {new Date(wh.lastEventAt).toLocaleString("pt-BR")}
                    {wh.lastEvent ? ` (${wh.lastEvent})` : ""}
                  </span>
                ) : (
                  <span className="text-rose-400">Nenhum evento recebido ainda</span>
                )}
              </div>
              {wh?.current && (
                <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">
                  Atual: {wh.current}
                </p>
              )}
              {wh?.expected && wh?.expected !== wh?.current && (
                <p className="mt-1 break-all font-mono text-[11px] text-emerald-400">
                  Esperado: {wh.expected}
                </p>
              )}
              {wh?.error && <p className="mt-2 text-xs text-rose-400">{wh.error}</p>}
            </Card>
          </div>

          {/* Metrics */}
          <Card title="Envios últimas 24h" icon={Send}>
            <div className="grid gap-3 md:grid-cols-5">
              <Metric label="Total" value={m?.total ?? 0} />
              <Metric label="Entregues" value={m?.delivered ?? 0} tone="ok" />
              <Metric label="Lidas" value={m?.read ?? 0} tone="ok" />
              <Metric label="Pendentes" value={m?.pending ?? 0} tone="warn" />
              <Metric label="Com erro" value={m?.errored ?? 0} tone="bad" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <RateBar label="Taxa de entrega" value={m?.deliveryRate} tone="ok" />
              <RateBar label="Taxa de erro" value={m?.errorRate} tone="bad" />
            </div>
          </Card>

          {/* Failures */}
          <Card title={`Últimas falhas de envio (${report.failures?.length ?? 0})`} icon={XCircle}>
            {(!report.failures || report.failures.length === 0) ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma falha recente. 🎉
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {report.failures.map((f: Report) => (
                  <li key={f.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {f.preview || <span className="italic text-muted-foreground">sem conteúdo</span>}
                        </p>
                        <p className="mt-1 text-xs text-rose-400">
                          {f.error || `Status: ${f.status ?? "?"}`}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(f.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Ingest logs */}
          <Card title="Eventos recebidos (últimas 6h)" icon={Clock}>
            <div className="flex flex-wrap gap-2">
              {Object.entries(report.ingest6h?.byStatus ?? {}).map(([k, v]) => (
                <span
                  key={k}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                    k === "saved" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                    k === "error" && "border-rose-500/30 bg-rose-500/10 text-rose-400",
                    k === "ignored" && "border-amber-500/30 bg-amber-500/10 text-amber-400",
                    k !== "saved" && k !== "error" && k !== "ignored" && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {k}: {String(v)}
                </span>
              ))}
              {Object.keys(report.ingest6h?.byStatus ?? {}).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum evento nas últimas 6h.</p>
              )}
            </div>
            {report.ingest6h?.recentErrors?.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">Últimos erros de ingest:</p>
                {report.ingest6h.recentErrors.map((e: Report, i: number) => (
                  <div key={i} className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-xs">
                    <p className="text-rose-400">{e.error || e.event}</p>
                    <p className="text-muted-foreground">
                      {e.phone ?? "—"} · {new Date(e.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Gerado em {new Date(report.generatedAt).toLocaleString("pt-BR")} · {report.elapsedMs}ms
          </p>
        </>
      )}
    </div>
    </AdminShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const color =
    tone === "ok" ? "text-emerald-400"
    : tone === "warn" ? "text-amber-400"
    : tone === "bad" ? "text-rose-400"
    : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>{value}</p>
    </div>
  );
}

function RateBar({ label, value, tone }: { label: string; value: number | null | undefined; tone: "ok" | "bad" }) {
  const pct = value ?? 0;
  const color = tone === "ok" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value == null ? "—" : `${pct}%`}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full transition-all", color)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
