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
  FileDown, Save, Send, Play, Clock, MessageSquare, Trash2, Plus,
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

export const Route = createFileRoute("/_authenticated/caixa-fechamento")({
  head: () => ({ meta: [{ title: "Fechamento de Caixa — Admin" }, { name: "robots", content: "noindex" }] }),
  component: CashClosePage,
});

function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? "bg-purple-600" : "bg-slate-300"
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 ${className}`}
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

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 p-3 text-white shadow-lg">
                <FileDown className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Fechamento de Caixa</h1>
                <p className="text-sm text-slate-500">
                  Relatório automático diário via WhatsApp — vendas, PIX vs. dinheiro, sangrias e mais.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex gap-2 border-b border-slate-200">
          {(["gerar", "historico", "config"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium transition ${
                tab === k
                  ? "border-b-2 border-purple-600 text-purple-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {k === "gerar" ? "Gerar Relatório" : k === "historico" ? "Histórico" : "Configurações"}
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
  const today = new Date().toISOString().slice(0, 10);
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
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="mb-1 block text-xs">Data do relatório</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today} className="w-44" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Switch checked={includePending} onCheckedChange={setIncludePending} />
            <span>Incluir pendentes</span>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Switch checked={includeCanceled} onCheckedChange={setIncludeCanceled} />
            <span>Incluir cancelados</span>
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RotateCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar prévia
            </Button>
            <Button onClick={run} disabled={running || !agg}>
              <Send className="mr-2 h-4 w-4" />
              {running ? "Enviando…" : "Gerar & Enviar agora"}
            </Button>
          </div>
        </div>
      </div>

      {loading && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Calculando…</div>}

      {agg && !loading && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Pedidos" value={String(agg.orders.orders_count)} tone="purple" />
            <Kpi label="Faturamento" value={BRL(agg.orders.revenue)} tone="green" />
            <Kpi label="Ticket médio" value={BRL(agg.orders.avg_ticket)} tone="blue" />
            <Kpi label="Taxa de entrega" value={BRL(agg.orders.delivery_fees)} tone="amber" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Formas de pagamento (PDV)">
              {agg.payments.length === 0 ? (
                <p className="text-sm text-slate-500">Sem movimentos de PDV neste dia.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {agg.payments.map((p: any) => (
                    <li key={p.method} className="flex items-center justify-between py-2">
                      <span className="capitalize">{p.method} <span className="text-slate-400">({p.count})</span></span>
                      <strong>{BRL(p.amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Por canal">
              {agg.by_mode.length === 0 ? (
                <p className="text-sm text-slate-500">Sem dados.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {agg.by_mode.map((m: any) => (
                    <li key={m.mode} className="flex items-center justify-between py-2">
                      <span className="capitalize">{m.mode} <span className="text-slate-400">({m.count})</span></span>
                      <strong>{BRL(m.revenue)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Movimentos de caixa">
              {Object.keys(agg.movements ?? {}).length === 0 ? (
                <p className="text-sm text-slate-500">Sem movimentos manuais.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {Object.entries(agg.movements as Record<string, any>).map(([k, m]) => (
                    <li key={k} className="flex items-center justify-between py-2">
                      <span className="capitalize">{k} <span className="text-slate-400">({m.count})</span></span>
                      <strong>{BRL(m.amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Top produtos">
              {agg.top_products.length === 0 ? (
                <p className="text-sm text-slate-500">Sem vendas.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {agg.top_products.slice(0, 8).map((p: any, i: number) => (
                    <li key={i} className="flex items-center justify-between py-2">
                      <span className="truncate">{i + 1}. {p.product_name} <span className="text-slate-400">({p.qty}×)</span></span>
                      <strong>{BRL(p.revenue)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title="Prévia da mensagem WhatsApp" icon={<MessageSquare className="h-4 w-4" />}>
            <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 font-mono text-xs text-slate-700">
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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h2 className="text-sm font-semibold">Histórico de relatórios</h2>
      </div>
      {loading ? (
        <div className="p-10 text-center text-sm text-slate-500">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">Nenhum fechamento gerado ainda.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Data</th>
                <th className="px-4 py-2 text-left">Origem</th>
                <th className="px-4 py-2 text-right">Pedidos</th>
                <th className="px-4 py-2 text-right">Faturamento</th>
                <th className="px-4 py-2 text-left">Envio</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const totals = r.totals as any;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{new Date(r.report_date + "T12:00:00").toLocaleDateString("pt-BR")}</div>
                      <div className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                    </td>
                    <td className="px-4 py-3 capitalize">{r.triggered_by}</td>
                    <td className="px-4 py-3 text-right">{totals?.orders?.orders_count ?? 0}</td>
                    <td className="px-4 py-3 text-right font-medium">{BRL(totals?.orders?.revenue ?? 0)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.whatsapp_status} />
                      {r.whatsapp_error && (
                        <div className="mt-1 max-w-xs truncate text-xs text-rose-500" title={r.whatsapp_error}>
                          {r.whatsapp_error}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {r.pdf_path && (
                          <Button size="sm" variant="outline" onClick={() => download(r.id)}>
                            <Download className="mr-1 h-3.5 w-3.5" /> PDF
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => resend(r.id)}>
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

  if (!s) return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Carregando…</div>;

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

  return (
    <div className="space-y-6">
      {/* Toggle enabled */}
      <Card title="Envio automático" icon={<Clock className="h-4 w-4" />}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Enviar fechamento automaticamente</p>
            <p className="text-xs text-slate-500">
              O relatório é gerado e disparado no horário configurado, respeitando o fuso e os dias selecionados.
            </p>
          </div>
          <Switch checked={!!s.enabled} onCheckedChange={(v) => patch("enabled", v)} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="mb-1 block text-xs">Hora</Label>
            <Input type="number" min={0} max={23} value={s.send_hour ?? 23}
              onChange={(e) => patch("send_hour", Math.min(23, Math.max(0, Number(e.target.value) || 0)))} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Minuto</Label>
            <Input type="number" min={0} max={59} value={s.send_minute ?? 30}
              onChange={(e) => patch("send_minute", Math.min(59, Math.max(0, Number(e.target.value) || 0)))} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Fuso horário (IANA)</Label>
            <Input value={s.timezone ?? "America/Sao_Paulo"} onChange={(e) => patch("timezone", e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <Label className="mb-2 block text-xs">Dias da semana</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = (s.weekdays ?? []).includes(d.v);
              return (
                <button
                  key={d.v}
                  onClick={() => toggleWeekday(d.v)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    on ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {s.last_run_at && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Última execução: <strong>{new Date(s.last_run_at).toLocaleString("pt-BR")}</strong> —{" "}
            <StatusBadge status={s.last_run_status ?? "unknown"} />
            {s.last_run_error && <div className="mt-1 text-rose-600">{s.last_run_error}</div>}
          </div>
        )}
      </Card>

      {/* WhatsApp numbers */}
      <Card title="Destinatários (WhatsApp)" icon={<MessageSquare className="h-4 w-4" />}>
        <p className="mb-3 text-xs text-slate-500">
          Números com DDI+DDD (ex: <code>5511999999999</code>). Cada número recebe o resumo em texto e o PDF anexado.
        </p>
        <div className="space-y-2">
          {(s.whatsapp_numbers ?? []).length === 0 && (
            <p className="text-xs text-slate-400">Nenhum número configurado. Adicione ao menos um para envio automático.</p>
          )}
          {(s.whatsapp_numbers ?? []).map((n: string, i: number) => (
            <div key={i} className="flex gap-2">
              <Input value={n} onChange={(e) => setNumber(i, e.target.value)} placeholder="5511999999999" />
              <Button variant="outline" size="icon" onClick={() => removeNumber(i)}>
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addNumber}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar número
          </Button>
        </div>
      </Card>

      {/* Conteúdo */}
      <Card title="Conteúdo do relatório" icon={<FileText className="h-4 w-4" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!s.send_pdf} onCheckedChange={(v) => patch("send_pdf", v)} />
            Anexar PDF completo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!s.send_text_summary} onCheckedChange={(v) => patch("send_text_summary", v)} />
            Enviar resumo em texto
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!s.include_pending} onCheckedChange={(v) => patch("include_pending", v)} />
            Incluir pedidos pendentes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!s.include_canceled} onCheckedChange={(v) => patch("include_canceled", v)} />
            Incluir pedidos cancelados
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Switch checked={!!s.auto_close_session} onCheckedChange={(v) => patch("auto_close_session", v)} />
            Fechar sessões de PDV que ficaram abertas
          </label>
        </div>
        <div className="mt-4 grid gap-3">
          <div>
            <Label className="mb-1 block text-xs">Cabeçalho personalizado</Label>
            <Textarea rows={2} value={s.custom_header ?? ""} onChange={(e) => patch("custom_header", e.target.value)}
              placeholder="Ex: Bom dia, chefe! Segue o fechamento de ontem." />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Rodapé personalizado</Label>
            <Textarea rows={2} value={s.custom_footer ?? ""} onChange={(e) => patch("custom_footer", e.target.value)}
              placeholder="Ex: Qualquer dúvida, chama no chat." />
          </div>
        </div>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
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
    purple: "from-purple-500 to-fuchsia-500",
    green: "from-emerald-500 to-teal-500",
    blue: "from-sky-500 to-blue-500",
    amber: "from-amber-500 to-orange-500",
  }[tone];
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${bg} p-4 text-white shadow-sm`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; className: string; Icon: any }> = {
    sent: { label: "Enviado", className: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
    partial: { label: "Parcial", className: "bg-amber-100 text-amber-700", Icon: AlertTriangle },
    failed: { label: "Falhou", className: "bg-rose-100 text-rose-700", Icon: XCircle },
    skipped: { label: "Sem envio", className: "bg-slate-100 text-slate-600", Icon: Clock },
  };
  const c = cfg[status] ?? { label: status, className: "bg-slate-100 text-slate-600", Icon: Clock };
  const I = c.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.className}`}>
      <I className="h-3 w-3" />
      {c.label}
    </span>
  );
}
