import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { toast } from "sonner";
import {
  FileDown, Save, Send, Clock, MessageSquare, Trash2, Plus,
  CheckCircle2, XCircle, AlertTriangle, Download, RotateCcw, FileText,
} from "lucide-react";
import {
  getCashCloseSettings,
  updateCashCloseSettings,
  previewCashClose,
  runCashCloseNow,
  listCashCloseReports,
  getCashCloseReportUrl,
  resendCashCloseReport,
} from "@/lib/cash-close.functions";
import { todayInSP, formatSP, formatDateSP, parseDateOnlySP } from "@/lib/tz";

export const Route = createFileRoute("/_authenticated/caixa-fechamento")({
  head: () => ({ meta: [{ title: "Fechamento de Caixa — Admin" }, { name: "robots", content: "noindex" }] }),
  component: CashClosePage,
});

function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
        checked ? "bg-fuchsia-500" : "bg-white/15",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={cn(
        "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-400/60 focus:ring-2 focus:ring-fuchsia-500/20",
        className,
      )}
    />
  );
}

const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));

const WEEKDAYS = [
  { v: 0, label: "Dom" }, { v: 1, label: "Seg" }, { v: 2, label: "Ter" }, { v: 3, label: "Qua" },
  { v: 4, label: "Qui" }, { v: 5, label: "Sex" }, { v: 6, label: "Sáb" },
];

type Tab = "gerar" | "historico" | "config";

function CashClosePage() {
  const [tab, setTab] = useState<Tab>("gerar");

  const tabs: { k: Tab; label: string }[] = [
    { k: "gerar", label: "Gerar Relatório" },
    { k: "historico", label: "Histórico" },
    { k: "config", label: "Configurações" },
  ];

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-4 sm:py-6">
        <header className="flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 p-3 text-white shadow-lg shrink-0">
            <FileDown className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Fechamento de Caixa</h1>
            <p className="text-xs sm:text-sm text-white/60">
              Relatório automático diário via WhatsApp — vendas, PIX vs. dinheiro, sangrias e mais.
            </p>
          </div>
        </header>

        <div className="flex gap-1 border-b border-white/10 overflow-x-auto scrollbar-none -mx-1 px-1">
          {tabs.map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition whitespace-nowrap border-b-2 -mb-px",
                tab === k
                  ? "border-fuchsia-500 text-white"
                  : "border-transparent text-white/50 hover:text-white/80",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "gerar" && <GerarTab />}
        {tab === "historico" && <HistoricoTab />}
        {tab === "config" && <ConfigTab />}
      </div>
    </AdminShell>
  );
}

// ---------------- Gerar tab ----------------

function GerarTab() {
  const today = todayInSP();
  const [date, setDate] = useState(today);
  const [includePending, setIncludePending] = useState(false);
  const [includeCanceled, setIncludeCanceled] = useState(false);
  const [preview, setPreview] = useState<{ aggregate: any; summary: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const previewFn = useServerFn(previewCashClose);
  const runFn = useServerFn(runCashCloseNow);

  const load = async () => {
    setLoading(true);
    try {
      const r = await previewFn({
        data: { date, include_pending: includePending, include_canceled: includeCanceled },
      });
      setPreview(r as any);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar prévia");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const run = async () => {
    if (!(await confirmDialog({ message: `Gerar fechamento para ${date} e enviar via WhatsApp agora?` }))) return;
    setRunning(true);
    try {
      const r: any = await runFn({ data: { date } });
      if (r.whatsapp_status === "sent") toast.success(`Enviado para ${r.targets_ok.length} número(s).`);
      else if (r.whatsapp_status === "partial") toast.warning(`Enviado parcialmente. Falhou: ${r.targets_failed.join(", ")}`);
      else if (r.whatsapp_status === "skipped") toast.info("PDF gerado, mas nenhum número configurado.");
      else toast.error(`Falha no envio: ${r.whatsapp_error ?? ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar fechamento");
    } finally {
      setRunning(false);
    }
  };

  const agg = preview?.aggregate;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 shadow-sm">
        <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-end">
          <div className="min-w-0">
            <Label className="mb-1 block text-xs text-white/60">Data do relatório</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              className="w-full sm:w-44 bg-white/5 border-white/10 text-white [color-scheme:dark]"
            />
          </div>
          <div className="flex flex-wrap gap-4 sm:gap-3 sm:pb-2">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <Switch checked={includePending} onCheckedChange={setIncludePending} />
              <span>Incluir pendentes</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <Switch checked={includeCanceled} onCheckedChange={setIncludeCanceled} />
              <span>Incluir cancelados</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex">
            <Button variant="outline" onClick={load} disabled={loading} className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              <RotateCcw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              <span className="hidden sm:inline">Atualizar prévia</span>
              <span className="sm:hidden">Atualizar</span>
            </Button>
            <Button
              onClick={run}
              disabled={running || !agg}
              className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white hover:from-fuchsia-400 hover:to-purple-500"
            >
              <Send className="mr-2 h-4 w-4" />
              {running ? "Enviando…" : (<><span className="hidden sm:inline">Gerar & Enviar agora</span><span className="sm:hidden">Enviar</span></>)}
            </Button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-white/50">
          Calculando…
        </div>
      )}

      {agg && !loading && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Kpi label="Pedidos" value={String(agg.orders.orders_count)} tone="purple" />
            <Kpi label="Faturamento" value={BRL(agg.orders.revenue)} tone="green" />
            <Kpi label="Ticket médio" value={BRL(agg.orders.avg_ticket)} tone="blue" />
            <Kpi label="Taxa de entrega" value={BRL(agg.orders.delivery_fees)} tone="amber" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Formas de pagamento (PDV)">
              {agg.payments.length === 0 ? (
                <p className="text-sm text-white/50">Sem movimentos de PDV neste dia.</p>
              ) : (
                <ul className="divide-y divide-white/5 text-sm">
                  {agg.payments.map((p: any) => (
                    <li key={p.method} className="flex items-center justify-between py-2">
                      <span className="capitalize text-white/80">{p.method} <span className="text-white/40">({p.count})</span></span>
                      <strong className="text-white">{BRL(p.amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Por canal">
              {agg.by_mode.length === 0 ? (
                <p className="text-sm text-white/50">Sem dados.</p>
              ) : (
                <ul className="divide-y divide-white/5 text-sm">
                  {agg.by_mode.map((m: any) => (
                    <li key={m.mode} className="flex items-center justify-between py-2">
                      <span className="capitalize text-white/80">{m.mode} <span className="text-white/40">({m.count})</span></span>
                      <strong className="text-white">{BRL(m.revenue)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Movimentos de caixa">
              {Object.keys(agg.movements ?? {}).length === 0 ? (
                <p className="text-sm text-white/50">Sem movimentos manuais.</p>
              ) : (
                <ul className="divide-y divide-white/5 text-sm">
                  {Object.entries(agg.movements as Record<string, any>).map(([k, m]) => (
                    <li key={k} className="flex items-center justify-between py-2">
                      <span className="capitalize text-white/80">{k} <span className="text-white/40">({m.count})</span></span>
                      <strong className="text-white">{BRL(m.amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Top produtos">
              {agg.top_products.length === 0 ? (
                <p className="text-sm text-white/50">Sem vendas.</p>
              ) : (
                <ul className="divide-y divide-white/5 text-sm">
                  {agg.top_products.slice(0, 8).map((p: any, i: number) => (
                    <li key={i} className="flex items-center justify-between py-2 gap-3">
                      <span className="truncate text-white/80">{i + 1}. {p.product_name} <span className="text-white/40">({p.qty}×)</span></span>
                      <strong className="text-white shrink-0">{BRL(p.revenue)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title="Prévia da mensagem WhatsApp" icon={<MessageSquare className="h-4 w-4" />}>
            <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 border border-white/5 p-4 font-mono text-xs text-white/80">
              {preview!.summary}
            </pre>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------------- Histórico tab ----------------

function HistoricoTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const listFn = useServerFn(listCashCloseReports);
  const urlFn = useServerFn(getCashCloseReportUrl);
  const resendFn = useServerFn(resendCashCloseReport);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listFn({ data: { limit: 100 } });
      setRows((r as any) ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao listar relatórios");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const download = async (id: string) => {
    try {
      const r: any = await urlFn({ data: { report_id: id } });
      window.open(r.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sem PDF disponível");
    }
  };
  const resend = async (id: string) => {
    if (!(await confirmDialog({ message: "Reenviar este relatório para os números configurados?" }))) return;
    try {
      const r: any = await resendFn({ data: { report_id: id } });
      if (r.failed.length) toast.warning(`Falhou: ${r.failed.join(", ")}`);
      else toast.success(`Reenviado para ${r.ok.length} número(s).`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no reenvio");
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 shadow-sm overflow-hidden">
      <div className="border-b border-white/10 p-4">
        <h2 className="text-sm font-semibold text-white">Histórico de relatórios</h2>
      </div>
      {loading ? (
        <div className="p-10 text-center text-sm text-white/50">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-white/50">Nenhum fechamento gerado ainda.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-2 p-3 sm:hidden">
            {rows.map((r) => {
              const totals = r.totals as any;
              return (
                <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-white">{formatDateSP(parseDateOnlySP(r.report_date))}</div>
                      <div className="text-[11px] text-white/40">{formatSP(r.created_at)} · {r.triggered_by}</div>
                    </div>
                    <StatusBadge status={r.whatsapp_status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-white/60">{totals?.orders?.orders_count ?? 0} pedidos</span>
                    <strong className="text-white">{BRL(totals?.orders?.revenue ?? 0)}</strong>
                  </div>
                  {r.whatsapp_error && (
                    <div className="mt-2 text-xs text-rose-300 break-words" title={r.whatsapp_error}>
                      {r.whatsapp_error}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    {r.pdf_path && (
                      <Button size="sm" variant="outline" onClick={() => download(r.id)} className="flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10">
                        <Download className="mr-1 h-3.5 w-3.5" /> PDF
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => resend(r.id)} className="flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10">
                      <Send className="mr-1 h-3.5 w-3.5" /> Reenviar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase text-white/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Data</th>
                  <th className="px-4 py-2 text-left font-medium">Origem</th>
                  <th className="px-4 py-2 text-right font-medium">Pedidos</th>
                  <th className="px-4 py-2 text-right font-medium">Faturamento</th>
                  <th className="px-4 py-2 text-left font-medium">Envio</th>
                  <th className="px-4 py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => {
                  const totals = r.totals as any;
                  return (
                    <tr key={r.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{formatDateSP(parseDateOnlySP(r.report_date))}</div>
                        <div className="text-xs text-white/40">{formatSP(r.created_at)}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-white/70">{r.triggered_by}</td>
                      <td className="px-4 py-3 text-right text-white/80">{totals?.orders?.orders_count ?? 0}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">{BRL(totals?.orders?.revenue ?? 0)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.whatsapp_status} />
                        {r.whatsapp_error && (
                          <div className="mt-1 max-w-xs truncate text-xs text-rose-300" title={r.whatsapp_error}>
                            {r.whatsapp_error}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {r.pdf_path && (
                            <Button size="sm" variant="outline" onClick={() => download(r.id)} className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                              <Download className="mr-1 h-3.5 w-3.5" /> PDF
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => resend(r.id)} className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                            <Send className="mr-1 h-3.5 w-3.5" /> Reenviar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- Config tab ----------------

function ConfigTab() {
  const [s, setS] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const getFn = useServerFn(getCashCloseSettings);
  const setFn = useServerFn(updateCashCloseSettings);

  useEffect(() => { void (async () => setS(await getFn()))(); }, []);

  if (!s) return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-white/50">
      Carregando…
    </div>
  );

  const patch = (k: string, v: any) => setS({ ...s, [k]: v });

  const save = async () => {
    setSaving(true);
    try {
      const r = await setFn({
        data: {
          enabled: s.enabled,
          send_hour: s.send_hour,
          send_minute: s.send_minute,
          timezone: s.timezone,
          weekdays: s.weekdays,
          whatsapp_numbers: (s.whatsapp_numbers || []).filter((n: string) => n && n.trim()),
          send_pdf: s.send_pdf,
          send_text_summary: s.send_text_summary,
          include_pending: s.include_pending,
          include_canceled: s.include_canceled,
          auto_close_session: s.auto_close_session,
          custom_header: s.custom_header ?? "",
          custom_footer: s.custom_footer ?? "",
        },
      });
      setS(r);
      toast.success("Configurações salvas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const addNumber = () => patch("whatsapp_numbers", [...(s.whatsapp_numbers ?? []), ""]);
  const setNumber = (i: number, v: string) => {
    const arr = [...(s.whatsapp_numbers ?? [])];
    arr[i] = v;
    patch("whatsapp_numbers", arr);
  };
  const removeNumber = (i: number) => {
    const arr = [...(s.whatsapp_numbers ?? [])];
    arr.splice(i, 1);
    patch("whatsapp_numbers", arr);
  };

  const toggleWeekday = (v: number) => {
    const set = new Set<number>(s.weekdays ?? []);
    if (set.has(v)) set.delete(v); else set.add(v);
    patch("weekdays", [...set].sort());
  };

  const inputCls = "bg-white/5 border-white/10 text-white [color-scheme:dark]";

  return (
    <div className="space-y-5 pb-24">
      <Card title="Envio automático" icon={<Clock className="h-4 w-4" />}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">Enviar fechamento automaticamente</p>
            <p className="text-xs text-white/50">
              O relatório é gerado e disparado no horário configurado, respeitando o fuso e os dias selecionados.
            </p>
          </div>
          <Switch checked={!!s.enabled} onCheckedChange={(v) => patch("enabled", v)} />
        </div>

        <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3">
          <div>
            <Label className="mb-1 block text-xs text-white/60">Hora</Label>
            <Input type="number" min={0} max={23} value={s.send_hour ?? 23} className={inputCls}
              onChange={(e) => patch("send_hour", Math.min(23, Math.max(0, Number(e.target.value) || 0)))} />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-white/60">Minuto</Label>
            <Input type="number" min={0} max={59} value={s.send_minute ?? 30} className={inputCls}
              onChange={(e) => patch("send_minute", Math.min(59, Math.max(0, Number(e.target.value) || 0)))} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label className="mb-1 block text-xs text-white/60">Fuso horário (IANA)</Label>
            <Input value={s.timezone ?? "America/Sao_Paulo"} className={inputCls}
              onChange={(e) => patch("timezone", e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <Label className="mb-2 block text-xs text-white/60">Dias da semana</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = (s.weekdays ?? []).includes(d.v);
              return (
                <button
                  key={d.v}
                  onClick={() => toggleWeekday(d.v)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition min-w-[44px]",
                    on
                      ? "bg-fuchsia-500 text-white shadow-sm shadow-fuchsia-500/30"
                      : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10",
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {s.last_run_at && (
          <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-3 text-xs text-white/70">
            Última execução: <strong className="text-white">{formatSP(s.last_run_at)}</strong>{" "}
            <StatusBadge status={s.last_run_status ?? "unknown"} />
            {s.last_run_error && <div className="mt-1 text-rose-300 break-words">{s.last_run_error}</div>}
          </div>
        )}
      </Card>

      <Card title="Destinatários (WhatsApp)" icon={<MessageSquare className="h-4 w-4" />}>
        <p className="mb-3 text-xs text-white/50">
          Números com DDI+DDD (ex: <code className="rounded bg-white/10 px-1 text-white/80">5511999999999</code>). Cada número recebe o resumo em texto e o PDF anexado.
        </p>
        <div className="space-y-2">
          {(s.whatsapp_numbers ?? []).length === 0 && (
            <p className="text-xs text-white/40">Nenhum número configurado. Adicione ao menos um para envio automático.</p>
          )}
          {(s.whatsapp_numbers ?? []).map((n: string, i: number) => (
            <div key={i} className="flex gap-2">
              <Input value={n} onChange={(e) => setNumber(i, e.target.value)} placeholder="5511999999999" className={inputCls} />
              <Button variant="outline" size="icon" onClick={() => removeNumber(i)} className="border-white/15 bg-white/5 hover:bg-rose-500/10 shrink-0">
                <Trash2 className="h-4 w-4 text-rose-400" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addNumber} className="border-white/15 bg-white/5 text-white hover:bg-white/10">
            <Plus className="mr-1 h-4 w-4" /> Adicionar número
          </Button>
        </div>
      </Card>

      <Card title="Conteúdo do relatório" icon={<FileText className="h-4 w-4" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-white/80">
            <Switch checked={!!s.send_pdf} onCheckedChange={(v) => patch("send_pdf", v)} />
            Anexar PDF completo
          </label>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <Switch checked={!!s.send_text_summary} onCheckedChange={(v) => patch("send_text_summary", v)} />
            Enviar resumo em texto
          </label>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <Switch checked={!!s.include_pending} onCheckedChange={(v) => patch("include_pending", v)} />
            Incluir pedidos pendentes
          </label>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <Switch checked={!!s.include_canceled} onCheckedChange={(v) => patch("include_canceled", v)} />
            Incluir pedidos cancelados
          </label>
          <label className="flex items-center gap-2 text-sm text-white/80 sm:col-span-2">
            <Switch checked={!!s.auto_close_session} onCheckedChange={(v) => patch("auto_close_session", v)} />
            Fechar sessões de PDV que ficaram abertas
          </label>
        </div>
        <div className="mt-4 grid gap-3">
          <div>
            <Label className="mb-1 block text-xs text-white/60">Cabeçalho personalizado</Label>
            <Textarea rows={2} value={s.custom_header ?? ""} onChange={(e) => patch("custom_header", e.target.value)}
              placeholder="Ex: Bom dia, chefe! Segue o fechamento de ontem." />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-white/60">Rodapé personalizado</Label>
            <Textarea rows={2} value={s.custom_footer ?? ""} onChange={(e) => patch("custom_footer", e.target.value)}
              placeholder="Ex: Qualquer dúvida, chama no chat." />
          </div>
        </div>
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button
          onClick={save}
          disabled={saving}
          size="lg"
          className="w-full sm:w-auto bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-fuchsia-500/20 hover:from-fuchsia-400 hover:to-purple-500"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}

// ---------------- helpers ----------------

function Kpi({ label, value, tone }: { label: string; value: string; tone: "purple" | "green" | "blue" | "amber" }) {
  const bg = {
    purple: "from-purple-500/80 to-fuchsia-500/80",
    green: "from-emerald-500/80 to-teal-500/80",
    blue: "from-sky-500/80 to-blue-500/80",
    amber: "from-amber-500/80 to-orange-500/80",
  }[tone];
  return (
    <div className={cn("rounded-2xl bg-gradient-to-br p-4 text-white shadow-sm border border-white/10", bg)}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-xl sm:text-2xl font-bold truncate">{value}</div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; className: string; Icon: any }> = {
    sent: { label: "Enviado", className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", Icon: CheckCircle2 },
    partial: { label: "Parcial", className: "bg-amber-500/15 text-amber-300 border border-amber-500/30", Icon: AlertTriangle },
    failed: { label: "Falhou", className: "bg-rose-500/15 text-rose-300 border border-rose-500/30", Icon: XCircle },
    skipped: { label: "Sem envio", className: "bg-white/10 text-white/60 border border-white/15", Icon: Clock },
  };
  const c = cfg[status] ?? { label: status, className: "bg-white/10 text-white/60 border border-white/15", Icon: Clock };
  const I = c.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", c.className)}>
      <I className="h-3 w-3" />
      {c.label}
    </span>
  );
}
