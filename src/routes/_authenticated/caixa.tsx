import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Wallet,
  Lock,
  Unlock,
  ArrowUpCircle,
  ArrowDownCircle,
  Banknote,
  CreditCard,
  Smartphone,
  Ticket,
  Receipt,
  RefreshCcw,
  History,
  Printer,
  Download,
  TrendingUp,
  TrendingDown,
  Clock,
  X,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CaixaPage,
});

type SessionRow = {
  id: string;
  operator_id: string | null;
  operator_name: string | null;
  terminal: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  counted_amount: number | null;
  expected_amount: number | null;
  difference: number | null;
  status: "open" | "closed";
  opening_note: string | null;
  closing_note: string | null;
};

type MovementRow = {
  id: string;
  session_id: string;
  type: "sale" | "sangria" | "reforco" | "suprimento" | "troco" | "estorno" | "ajuste";
  payment_method: "dinheiro" | "pix" | "debito" | "credito" | "voucher" | "outro";
  amount: number;
  order_id: string | null;
  note: string | null;
  created_at: string;
};

const BRL = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const methodMeta: Record<MovementRow["payment_method"], { label: string; icon: typeof Banknote; color: string }> = {
  dinheiro: { label: "Dinheiro", icon: Banknote, color: "text-emerald-600 bg-emerald-50" },
  pix: { label: "Pix", icon: Smartphone, color: "text-sky-600 bg-sky-50" },
  debito: { label: "Débito", icon: CreditCard, color: "text-indigo-600 bg-indigo-50" },
  credito: { label: "Crédito", icon: CreditCard, color: "text-violet-600 bg-violet-50" },
  voucher: { label: "Voucher", icon: Ticket, color: "text-amber-600 bg-amber-50" },
  outro: { label: "Outro", icon: Receipt, color: "text-white/70 bg-white/10" },
};

const typeMeta: Record<MovementRow["type"], { label: string; sign: 1 | -1; tone: string }> = {
  sale: { label: "Venda", sign: 1, tone: "text-emerald-700" },
  reforco: { label: "Reforço", sign: 1, tone: "text-emerald-700" },
  suprimento: { label: "Suprimento", sign: 1, tone: "text-emerald-700" },
  sangria: { label: "Sangria", sign: -1, tone: "text-rose-700" },
  troco: { label: "Troco", sign: -1, tone: "text-rose-700" },
  estorno: { label: "Estorno", sign: -1, tone: "text-rose-700" },
  ajuste: { label: "Ajuste", sign: 1, tone: "text-white/80" },
};

function CaixaPage() {
  const [session, setSession] = useState<SessionRow | null>(null);
  const [movs, setMovs] = useState<MovementRow[]>([]);
  const [history, setHistory] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"atual" | "historico">("atual");
  const [openDialog, setOpenDialog] = useState<null | "abrir" | "fechar" | "mov" | "detail">(null);
  const [detailSession, setDetailSession] = useState<SessionRow | null>(null);
  const [detailMovs, setDetailMovs] = useState<MovementRow[]>([]);

  const load = async () => {
    setLoading(true);
    const { data: openRow } = await supabase.rpc("get_open_cash_session");
    const current = (Array.isArray(openRow) ? openRow[0] : openRow) as SessionRow | null;
    setSession(current ?? null);
    if (current) {
      const { data } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("session_id", current.id)
        .order("created_at", { ascending: false });
      setMovs((data as MovementRow[]) ?? []);
    } else {
      setMovs([]);
    }
    const { data: hist } = await supabase
      .from("cash_sessions")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(30);
    setHistory((hist as SessionRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("cash-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_sessions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_movements" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Aggregations
  const totals = useMemo(() => {
    const byMethod: Record<MovementRow["payment_method"], number> = {
      dinheiro: 0, pix: 0, debito: 0, credito: 0, voucher: 0, outro: 0,
    };
    let entradas = 0, saidas = 0, vendas = 0, sangria = 0, reforco = 0, cashOnly = 0;
    for (const m of movs) {
      const sign = typeMeta[m.type].sign;
      const v = Number(m.amount) * sign;
      if (m.type === "sale") { vendas += Number(m.amount); byMethod[m.payment_method] += Number(m.amount); }
      if (m.type === "sangria") sangria += Number(m.amount);
      if (m.type === "reforco") reforco += Number(m.amount);
      if (sign > 0) entradas += Number(m.amount); else saidas += Number(m.amount);
      if (m.payment_method === "dinheiro") cashOnly += v;
    }
    const expected = (session?.opening_amount ?? 0) + cashOnly;
    return { byMethod, entradas, saidas, vendas, sangria, reforco, expected };
  }, [movs, session]);

  const openDetail = async (s: SessionRow) => {
    setDetailSession(s);
    const { data } = await supabase
      .from("cash_movements")
      .select("*")
      .eq("session_id", s.id)
      .order("created_at", { ascending: true });
    setDetailMovs((data as MovementRow[]) ?? []);
    setOpenDialog("detail");
  };

  const exportCsv = (s: SessionRow, list: MovementRow[]) => {
    const rows = [
      ["Data","Tipo","Método","Valor","Nota"],
      ...list.map(m => [
        new Date(m.created_at).toLocaleString("pt-BR"),
        typeMeta[m.type].label,
        methodMeta[m.payment_method].label,
        String(Number(m.amount).toFixed(2)).replace(".", ","),
        (m.note ?? "").replace(/[\n;]/g, " "),
      ]),
    ];
    const csv = rows.map(r => r.map(f => `"${String(f).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caixa-${new Date(s.opened_at).toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printZ = (s: SessionRow, list: MovementRow[]) => {
    const w = window.open("", "_blank", "width=380,height=640");
    if (!w) return;
    const byM: Record<string, number> = {};
    let vendas = 0, sangria = 0, reforco = 0;
    for (const m of list) {
      if (m.type === "sale") { vendas += Number(m.amount); byM[m.payment_method] = (byM[m.payment_method] ?? 0) + Number(m.amount); }
      if (m.type === "sangria") sangria += Number(m.amount);
      if (m.type === "reforco") reforco += Number(m.amount);
    }
    w.document.write(`<pre style="font-family:ui-monospace,monospace;font-size:12px;padding:12px">
========================
   FECHAMENTO DE CAIXA
========================
Abertura: ${new Date(s.opened_at).toLocaleString("pt-BR")}
Fechamento: ${s.closed_at ? new Date(s.closed_at).toLocaleString("pt-BR") : "-"}
Operador: ${s.operator_name ?? "-"}
Terminal: ${s.terminal ?? "-"}
------------------------
Abertura:      ${BRL(s.opening_amount)}
Vendas:        ${BRL(vendas)}
Reforço:       ${BRL(reforco)}
Sangria:       ${BRL(sangria)}
------------------------
Por método:
${Object.entries(byM).map(([k,v]) => `  ${methodMeta[k as keyof typeof methodMeta].label.padEnd(10)} ${BRL(v)}`).join("\n") || "  -"}
------------------------
Esperado:      ${BRL(s.expected_amount ?? 0)}
Contado:       ${BRL(s.counted_amount ?? 0)}
Diferença:     ${BRL(s.difference ?? 0)}
========================
${s.closing_note ? `Obs: ${s.closing_note}` : ""}
</pre>`);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  return (
    <div className="min-h-screen bg-[#0c031f] text-white pb-24">
      {/* Header */}
      <div className="border-b bg-[#170a2e]/80 backdrop-blur-md border-white/10 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-xl grid place-items-center text-white",
              session ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-rose-500 to-rose-600")}>
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Caixa</h1>
              <p className="text-xs md:text-sm text-white/60 flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", session ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                {session ? `Aberto desde ${new Date(session.opened_at).toLocaleString("pt-BR")}` : "Caixa fechado"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-10 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" /> Atualizar
            </button>
            {session ? (
              <>
                <button onClick={() => setOpenDialog("mov")}
                  className="h-10 px-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Lançamento
                </button>
                <button onClick={() => setOpenDialog("fechar")}
                  className="h-10 px-4 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Fechar caixa
                </button>
              </>
            ) : (
              <button onClick={() => setOpenDialog("abrir")}
                className="h-10 px-5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2">
                <Unlock className="h-4 w-4" /> Abrir caixa
              </button>
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex gap-1 -mb-px">
          {[
            { id: "atual", label: "Sessão atual", icon: Wallet },
            { id: "historico", label: "Histórico", icon: History },
          ].map(t => {
            const Icon = t.icon; const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2",
                  active ? "border-white text-white" : "border-transparent text-white/60 hover:text-white/90")}>
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {loading && <div className="text-center py-12 text-white/40">Carregando…</div>}

        {!loading && tab === "atual" && !session && (
          <div className="rounded-2xl border-2 border-dashed border-white/15 p-12 text-center bg-white/5">
            <div className="h-16 w-16 rounded-full bg-white/10 grid place-items-center mx-auto mb-4">
              <Lock className="h-7 w-7 text-white/40" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Nenhum caixa aberto</h2>
            <p className="text-sm text-white/60 mb-6">Abra o caixa para começar a registrar vendas e movimentos.</p>
            <button onClick={() => setOpenDialog("abrir")}
              className="h-11 px-6 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold inline-flex items-center gap-2">
              <Unlock className="h-4 w-4" /> Abrir caixa
            </button>
          </div>
        )}

        {!loading && tab === "atual" && session && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi icon={Unlock} label="Abertura" value={BRL(session.opening_amount)} tone="slate" />
              <Kpi icon={TrendingUp} label="Entradas" value={BRL(totals.entradas)} tone="emerald" />
              <Kpi icon={TrendingDown} label="Saídas" value={BRL(totals.saidas)} tone="rose" />
              <Kpi icon={Wallet} label="Esperado em dinheiro" value={BRL(totals.expected)} tone="indigo" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Métodos */}
              <div className="lg:col-span-1 rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-white/60" /> Vendas por método
                </h3>
                <div className="space-y-2">
                  {(Object.keys(methodMeta) as MovementRow["payment_method"][]).map(m => {
                    const M = methodMeta[m]; const Icon = M.icon;
                    const v = totals.byMethod[m]; const pct = totals.vendas ? (v / totals.vendas) * 100 : 0;
                    return (
                      <div key={m} className="flex items-center gap-3">
                        <div className={cn("h-9 w-9 rounded-lg grid place-items-center", M.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-sm">
                            <span className="text-white/80">{M.label}</span>
                            <span className="font-semibold text-white">{BRL(v)}</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-white/10 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-sm">
                  <span className="text-white/60">Total de vendas</span>
                  <span className="font-bold text-white">{BRL(totals.vendas)}</span>
                </div>
              </div>

              {/* Movimentos */}
              <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5">
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Clock className="h-4 w-4 text-white/60" /> Movimentos ({movs.length})
                  </h3>
                  <button onClick={() => exportCsv(session, movs)}
                    className="text-xs text-white/70 hover:text-white flex items-center gap-1">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>
                </div>
                <div className="divide-y divide-white/10 max-h-[520px] overflow-auto">
                  {movs.length === 0 && (
                    <div className="p-10 text-center text-sm text-white/40">Nenhum movimento ainda.</div>
                  )}
                  {movs.map(m => {
                    const T = typeMeta[m.type]; const M = methodMeta[m.payment_method]; const Icon = M.icon;
                    return (
                      <div key={m.id} className="p-3 md:p-4 flex items-center gap-3 hover:bg-white/10">
                        <div className={cn("h-9 w-9 rounded-lg grid place-items-center", M.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{T.label}</span>
                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10 text-white/70">{M.label}</span>
                          </div>
                          <div className="text-xs text-white/60 truncate">
                            {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            {m.note ? ` · ${m.note}` : ""}
                          </div>
                        </div>
                        <div className={cn("text-sm font-bold tabular-nums", T.tone)}>
                          {T.sign > 0 ? "+" : "−"} {BRL(Number(m.amount))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {!loading && tab === "historico" && (
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Últimas sessões</h3>
              <span className="text-xs text-white/60">{history.length} registros</span>
            </div>
            <div className="divide-y divide-white/10">
              {history.length === 0 && (
                <div className="p-10 text-center text-sm text-white/40">Nenhuma sessão registrada.</div>
              )}
              {history.map(s => {
                const diff = Number(s.difference ?? 0);
                const isOpen = s.status === "open";
                return (
                  <button key={s.id} onClick={() => openDetail(s)}
                    className="w-full p-4 flex items-center gap-4 hover:bg-white/10 text-left">
                    <div className={cn("h-10 w-10 rounded-lg grid place-items-center",
                      isOpen ? "bg-emerald-50 text-emerald-600" : "bg-white/10 text-white/70")}>
                      {isOpen ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">
                        {new Date(s.opened_at).toLocaleString("pt-BR")}
                        {s.closed_at && ` → ${new Date(s.closed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                      </div>
                      <div className="text-xs text-white/60">
                        {s.operator_name ?? "Operador"} · Abertura {BRL(s.opening_amount)}
                        {isOpen && " · aberto"}
                      </div>
                    </div>
                    {!isOpen && (
                      <div className={cn("text-sm font-semibold tabular-nums px-3 py-1 rounded-full",
                        Math.abs(diff) < 0.01 ? "bg-emerald-50 text-emerald-700"
                          : diff > 0 ? "bg-sky-50 text-sky-700" : "bg-rose-50 text-rose-700")}>
                        {diff > 0 ? "+" : ""}{BRL(diff)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {openDialog === "abrir" && (
        <AbrirDialog onClose={() => setOpenDialog(null)} onDone={() => { setOpenDialog(null); load(); }} />
      )}
      {openDialog === "mov" && session && (
        <MovDialog sessionId={session.id} onClose={() => setOpenDialog(null)} onDone={() => { setOpenDialog(null); load(); }} />
      )}
      {openDialog === "fechar" && session && (
        <FecharDialog session={session} expected={totals.expected} onClose={() => setOpenDialog(null)}
          onDone={() => { setOpenDialog(null); load(); }} />
      )}
      {openDialog === "detail" && detailSession && (
        <DetailDialog session={detailSession} movs={detailMovs}
          onClose={() => setOpenDialog(null)}
          onPrint={() => printZ(detailSession, detailMovs)}
          onCsv={() => exportCsv(detailSession, detailMovs)} />
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Wallet; label: string; value: string; tone: string }) {
  const tones: Record<string, string> = {
    slate: "from-slate-500 to-slate-700",
    emerald: "from-emerald-500 to-emerald-600",
    rose: "from-rose-500 to-rose-600",
    indigo: "from-indigo-500 to-indigo-600",
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-xs text-white/60 mb-2">
        <div className={cn("h-6 w-6 rounded-md bg-gradient-to-br text-white grid place-items-center", tones[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        {label}
      </div>
      <div className="text-xl font-bold text-white tabular-nums">{value}</div>
    </div>
  );
}

/* -------- Dialogs -------- */

function DialogShell({ title, icon: Icon, onClose, children, footer, tone = "slate" }: {
  title: string; icon: typeof Wallet; onClose: () => void; children: React.ReactNode;
  footer?: React.ReactNode; tone?: string;
}) {
  const tones: Record<string, string> = {
    slate: "from-slate-500 to-slate-700",
    emerald: "from-emerald-500 to-emerald-600",
    rose: "from-rose-500 to-rose-600",
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#170a2e] text-white border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-lg bg-gradient-to-br text-white grid place-items-center", tones[tone])}>
              <Icon className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-white/10 grid place-items-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        {footer && <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

function AbrirDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const v = Number(amount.replace(",", "."));
    if (isNaN(v) || v < 0) { toast.error("Valor inválido"); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const meta = u.user?.user_metadata as any;
    const { error } = await supabase.from("cash_sessions").insert({
      operator_id: u.user?.id,
      operator_name: meta?.full_name ?? meta?.name ?? u.user?.email ?? "Operador",
      opening_amount: v,
      opening_note: note || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Caixa aberto");
    onDone();
  };
  return (
    <DialogShell title="Abrir caixa" icon={Unlock} tone="emerald" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="h-10 px-4 rounded-lg border border-white/10 bg-white/5 text-sm">Cancelar</button>
        <button onClick={submit} disabled={saving}
          className="h-10 px-5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold disabled:opacity-60">
          {saving ? "Abrindo…" : "Abrir caixa"}
        </button>
      </>}>
      <div>
        <label className="text-sm font-medium text-white/80">Valor de abertura (fundo de troco)</label>
        <div className="mt-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">R$</span>
          <input autoFocus value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00"
            className="w-full h-12 pl-10 pr-3 rounded-lg border border-white/10 bg-white/5 text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-white/80">Observação (opcional)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          className="mt-1 w-full rounded-lg border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
    </DialogShell>
  );
}

function MovDialog({ sessionId, onClose, onDone }: { sessionId: string; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<MovementRow["type"]>("sale");
  const [method, setMethod] = useState<MovementRow["payment_method"]>("dinheiro");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const v = Number(amount.replace(",", "."));
    if (isNaN(v) || v <= 0) { toast.error("Valor inválido"); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("cash_movements").insert({
      session_id: sessionId, type, payment_method: method, amount: v,
      note: note || null, created_by: u.user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Lançamento registrado");
    onDone();
  };
  const types: { id: MovementRow["type"]; label: string; icon: typeof Wallet; tone: string }[] = [
    { id: "sale", label: "Venda", icon: Receipt, tone: "emerald" },
    { id: "reforco", label: "Reforço", icon: ArrowUpCircle, tone: "emerald" },
    { id: "suprimento", label: "Suprimento", icon: ArrowUpCircle, tone: "emerald" },
    { id: "sangria", label: "Sangria", icon: ArrowDownCircle, tone: "rose" },
    { id: "troco", label: "Troco", icon: ArrowDownCircle, tone: "rose" },
    { id: "estorno", label: "Estorno", icon: ArrowDownCircle, tone: "rose" },
  ];
  return (
    <DialogShell title="Novo lançamento" icon={Plus} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="h-10 px-4 rounded-lg border border-white/10 bg-white/5 text-sm">Cancelar</button>
        <button onClick={submit} disabled={saving}
          className="h-10 px-5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold disabled:opacity-60">
          {saving ? "Salvando…" : "Registrar"}
        </button>
      </>}>
      <div>
        <label className="text-sm font-medium text-white/80 mb-2 block">Tipo</label>
        <div className="grid grid-cols-3 gap-2">
          {types.map(t => {
            const Icon = t.icon; const active = type === t.id;
            return (
              <button key={t.id} onClick={() => setType(t.id)}
                className={cn("p-3 rounded-lg border text-sm flex flex-col items-center gap-1 transition",
                  active ? (t.tone === "emerald" ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                                                 : "border-rose-500/60 bg-rose-500/15 text-rose-300")
                         : "border-white/10 hover:bg-white/10 text-white/70")}>
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-white/80 mb-2 block">Método</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(methodMeta) as MovementRow["payment_method"][]).map(m => {
            const M = methodMeta[m]; const Icon = M.icon; const active = method === m;
            return (
              <button key={m} onClick={() => setMethod(m)}
                className={cn("p-2.5 rounded-lg border text-xs flex flex-col items-center gap-1",
                  active ? "border-neon-pink/60 bg-neon-pink/15 text-white" : "border-white/10 hover:bg-white/10 text-white/70")}>
                <Icon className="h-4 w-4" />
                {M.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-white/80">Valor</label>
        <div className="mt-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">R$</span>
          <input autoFocus value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00"
            className="w-full h-12 pl-10 pr-3 rounded-lg border border-white/10 bg-white/5 text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-white/80">Observação</label>
        <input value={note} onChange={e => setNote(e.target.value)}
          className="mt-1 w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
      </div>
    </DialogShell>
  );
}

function FecharDialog({ session, expected, onClose, onDone }:
  { session: SessionRow; expected: number; onClose: () => void; onDone: () => void }) {
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const cv = Number(counted.replace(",", "."));
  const diff = isNaN(cv) ? 0 : cv - expected;
  const submit = async () => {
    if (isNaN(cv) || cv < 0) { toast.error("Informe o valor contado"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("close_cash_session", {
      _session_id: session.id, _counted: cv, _note: note || undefined,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Caixa fechado");
    onDone();
  };
  return (
    <DialogShell title="Fechar caixa" icon={Lock} tone="rose" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="h-10 px-4 rounded-lg border border-white/10 bg-white/5 text-sm">Cancelar</button>
        <button onClick={submit} disabled={saving}
          className="h-10 px-5 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-semibold disabled:opacity-60">
          {saving ? "Fechando…" : "Confirmar fechamento"}
        </button>
      </>}>
      <div className="rounded-xl bg-white/5 border p-3 space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-white/60">Abertura</span><span className="font-semibold tabular-nums">{BRL(session.opening_amount)}</span></div>
        <div className="flex justify-between"><span className="text-white/60">Esperado em dinheiro</span><span className="font-semibold tabular-nums">{BRL(expected)}</span></div>
      </div>
      <div>
        <label className="text-sm font-medium text-white/80">Valor contado em dinheiro</label>
        <div className="mt-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">R$</span>
          <input autoFocus value={counted} onChange={e => setCounted(e.target.value)} inputMode="decimal" placeholder="0,00"
            className="w-full h-12 pl-10 pr-3 rounded-lg border border-white/10 bg-white/5 text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-rose-500" />
        </div>
      </div>
      {counted && (
        <div className={cn("rounded-xl p-3 flex items-center gap-2 text-sm",
          Math.abs(diff) < 0.01 ? "bg-emerald-50 text-emerald-800"
            : diff > 0 ? "bg-sky-50 text-sky-800" : "bg-rose-50 text-rose-800")}>
          {Math.abs(diff) < 0.01 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span className="font-medium">
            {Math.abs(diff) < 0.01 ? "Caixa bate certinho" : diff > 0 ? "Sobra de" : "Falta de"}
          </span>
          <span className="font-bold tabular-nums ml-auto">{BRL(Math.abs(diff))}</span>
        </div>
      )}
      <div>
        <label className="text-sm font-medium text-white/80">Observação (opcional)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          className="mt-1 w-full rounded-lg border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
      </div>
    </DialogShell>
  );
}

function DetailDialog({ session, movs, onClose, onPrint, onCsv }:
  { session: SessionRow; movs: MovementRow[]; onClose: () => void; onPrint: () => void; onCsv: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[oklch(0.13_0.08_305)] text-white border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Sessão de {new Date(session.opened_at).toLocaleDateString("pt-BR")}</h3>
            <p className="text-xs text-white/60">{session.operator_name} · {session.terminal}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCsv} className="h-9 px-3 rounded-lg border text-xs flex items-center gap-1"><Download className="h-3.5 w-3.5" />CSV</button>
            <button onClick={onPrint} className="h-9 px-3 rounded-lg border text-xs flex items-center gap-1"><Printer className="h-3.5 w-3.5" />Imprimir</button>
            <button onClick={onClose} className="h-9 w-9 rounded-lg hover:bg-white/10 grid place-items-center"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-2 border-b border-white/10 bg-white/5">
          <Mini label="Abertura" value={BRL(session.opening_amount)} />
          <Mini label="Esperado" value={BRL(session.expected_amount ?? 0)} />
          <Mini label="Contado" value={BRL(session.counted_amount ?? 0)} />
          <Mini label="Diferença" value={BRL(session.difference ?? 0)}
            tone={Math.abs(Number(session.difference ?? 0)) < 0.01 ? "emerald" : (Number(session.difference) > 0 ? "sky" : "rose")} />
        </div>
        <div className="flex-1 overflow-auto divide-y divide-white/10">
          {movs.length === 0 && <div className="p-8 text-center text-sm text-white/40">Sem movimentos.</div>}
          {movs.map(m => {
            const T = typeMeta[m.type]; const M = methodMeta[m.payment_method]; const Icon = M.icon;
            return (
              <div key={m.id} className="p-3 flex items-center gap-3">
                <div className={cn("h-8 w-8 rounded-lg grid place-items-center", M.color)}><Icon className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{T.label} <span className="text-xs text-white/60">· {M.label}</span></div>
                  <div className="text-xs text-white/60">{new Date(m.created_at).toLocaleString("pt-BR")} {m.note ? `· ${m.note}` : ""}</div>
                </div>
                <div className={cn("text-sm font-bold tabular-nums", T.tone)}>{T.sign > 0 ? "+" : "−"} {BRL(Number(m.amount))}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, tone = "slate" }: { label: string; value: string; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "text-white", emerald: "text-emerald-700", sky: "text-sky-700", rose: "text-rose-700",
  };
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-2">
      <div className="text-[10px] uppercase tracking-wide text-white/60">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", tones[tone])}>{value}</div>
    </div>
  );
}
