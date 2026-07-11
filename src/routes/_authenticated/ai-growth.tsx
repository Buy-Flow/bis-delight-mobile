import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  ChevronLeft,
  RefreshCw,
  TrendingUp,
  Loader2,
  Send,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  Copy,
  Check,
  Wallet,
  AlertTriangle,
  Users,
  Zap,
  BrainCircuit,
  Trash2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AdminNavMenu } from "@/components/admin/AdminNavMenu";
import { useIsAdmin } from "@/lib/menu-data";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import {
  generateGrowthInsights,
  dismissGrowthInsight,
  dispatchGrowthCampaign,
  growthChat,
  getGrowthChatHistory,
  type GrowthReport,
  type GrowthInsight,
  type GrowthClient,
} from "@/lib/ai-growth.functions";

export const Route = createFileRoute("/_authenticated/ai-growth")({
  head: () => ({
    meta: [
      { title: "AI Growth Engine — Painel Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AIGrowthPage,
});

const PRIORITY_STYLE: Record<GrowthInsight["priority"], string> = {
  ALTA: "bg-red-500/20 text-red-200 border-red-500/40",
  MEDIA: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  OPORTUNIDADE: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
};

function AIGrowthPage() {
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const run = useServerFn(generateGrowthInsights);
  const dismissFn = useServerFn(dismissGrowthInsight);
  const dispatchFn = useServerFn(dispatchGrowthCampaign);

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<GrowthReport | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async (refresh = false) => {
    setLoading(true);
    try {
      const res = await run({ data: { refresh } });
      setReport(res);
      if (res.aiError) toast.warning(res.aiError);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-purple-950 flex items-center justify-center text-white/70">
        <Loader2 className="animate-spin h-6 w-6" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-purple-950 flex items-center justify-center text-white/80">
        Acesso restrito.
      </div>
    );
  }

  const dismiss = async (id: string) => {
    await dismissFn({ data: { id } });
    setReport((prev) =>
      prev
        ? {
            ...prev,
            insights: prev.insights.filter((i) => i.id !== id),
            opportunitiesCount: prev.opportunitiesCount - 1,
          }
        : prev,
    );
    toast.success("Oportunidade descartada");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-purple-950 to-black text-white pb-24">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-purple-500/20 bg-purple-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" /> Admin
          </Link>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-neon-yellow" />
            <span className="text-sm font-semibold">AI Growth Engine</span>
          </div>
          <AdminNavMenu />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Hero */}
        <HeroCard
          report={report}
          loading={loading}
          onRefresh={() => load(true)}
        />

        {/* Insights list */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-neon-yellow" />
              Oportunidades detectadas
            </h2>
            {report?.insights.length ? (
              <span className="text-xs text-white/50">
                {report.insights.length} ativas
              </span>
            ) : null}
          </div>

          {loading && !report ? (
            <SkeletonList />
          ) : !report?.insights.length ? (
            <EmptyState onRefresh={() => load(true)} />
          ) : (
            <ul className="space-y-3">
              {report.insights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  open={openId === insight.id}
                  onToggle={() =>
                    setOpenId((c) => (c === insight.id ? null : insight.id))
                  }
                  onDismiss={() => dismiss(insight.id)}
                  onDispatched={() => {
                    setReport((prev) =>
                      prev
                        ? {
                            ...prev,
                            insights: prev.insights.filter(
                              (i) => i.id !== insight.id,
                            ),
                          }
                        : prev,
                    );
                    setOpenId(null);
                  }}
                  dispatchFn={dispatchFn}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Chat */}
        <GrowthChatPanel />
      </div>
    </div>
  );
}

function HeroCard({
  report,
  loading,
  onRefresh,
}: {
  report: GrowthReport | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-3xl border border-neon-yellow/30 bg-gradient-to-br from-purple-900/80 via-purple-950/80 to-black/60 p-6 shadow-[0_20px_60px_-30px_rgba(250,204,21,0.35)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-neon-yellow">
            <TrendingUp className="h-4 w-4" /> Receita potencial recuperável
          </div>
          <div className="mt-2 text-4xl md:text-5xl font-black leading-none">
            {loading && !report ? (
              <span className="text-white/40">…</span>
            ) : (
              brl(report?.potentialRevenue ?? 0)
            )}
          </div>
          <p className="mt-2 text-sm text-white/70">
            Estimativa somando ticket médio × clientes reativáveis nos segmentos
            abaixo.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-neon-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Analisar agora
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniKPI
          icon={<Zap className="h-4 w-4" />}
          label="Oportunidades"
          value={String(report?.opportunitiesCount ?? 0)}
        />
        <MiniKPI
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Churn (60d)"
          value={`${report?.churnRate ?? 0}%`}
        />
        <MiniKPI
          icon={<Wallet className="h-4 w-4" />}
          label="Ticket médio"
          value={brl(report?.avgTicket ?? 0)}
        />
        <MiniKPI
          icon={<Users className="h-4 w-4" />}
          label="Ativos"
          value={String(report?.totalActive ?? 0)}
        />
      </div>
    </div>
  );
}

function MiniKPI({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/60">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5"
        />
      ))}
    </ul>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
      <BrainCircuit className="mx-auto h-8 w-8 text-neon-yellow/60" />
      <p className="mt-3 text-white/80">
        Nenhuma oportunidade agora. Rode a análise para buscar novas.
      </p>
      <button
        onClick={onRefresh}
        className="mt-4 rounded-full bg-neon-pink px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      >
        Analisar
      </button>
    </div>
  );
}

function InsightCard({
  insight,
  open,
  onToggle,
  onDismiss,
  onDispatched,
  dispatchFn,
}: {
  insight: GrowthInsight;
  open: boolean;
  onToggle: () => void;
  onDismiss: () => void;
  onDispatched: () => void;
  dispatchFn: ReturnType<typeof useServerFn<typeof dispatchGrowthCampaign>>;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(insight.clientes.map((c) => c.user_id)),
  );
  const [msg, setMsg] = useState(insight.mensagem);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleClient = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const dispatch = async () => {
    if (!selected.size) return toast.error("Selecione ao menos 1 cliente");
    setSending(true);
    try {
      const res = await dispatchFn({
        data: {
          insight_id: insight.id,
          message: msg,
          recipient_ids: Array.from(selected),
          channel: "whatsapp",
        },
      });
      if (!res.links.length)
        return toast.warning(
          "Nenhum cliente selecionado tem telefone cadastrado.",
        );
      // Open first, offer to copy the rest
      window.open(res.links[0].whatsapp_url, "_blank");
      toast.success(
        `Campanha registrada: ${res.dispatched} contato(s). Primeiro WhatsApp aberto.`,
      );
      onDispatched();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const copyMsg = async () => {
    await navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const withPhone = insight.clientes.filter((c) => c.phone).length;

  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-white/[0.02]"
      >
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
            PRIORITY_STYLE[insight.priority],
          )}
        >
          {insight.priority}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate">
            {insight.title}
          </div>
          <div className="text-xs text-white/60">
            {insight.count} cliente(s) • Impacto {brl(insight.impacto)}
            {withPhone > 0 && <> • {withPhone} com WhatsApp</>}
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-white/60" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/60" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/10 p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-white/70">
              Mensagem (WhatsApp)
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 p-3 text-sm text-white outline-none focus:border-neon-yellow"
              rows={3}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-white/50">
              <span>Use {"{nome}"} para inserir o primeiro nome.</span>
              <button
                onClick={copyMsg}
                className="inline-flex items-center gap-1 text-white/70 hover:text-white"
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-white/70">
                Clientes ({selected.size}/{insight.clientes.length})
              </label>
              <div className="flex gap-2 text-[11px]">
                <button
                  className="text-white/70 hover:text-white"
                  onClick={() =>
                    setSelected(new Set(insight.clientes.map((c) => c.user_id)))
                  }
                >
                  Todos
                </button>
                <button
                  className="text-white/50 hover:text-white"
                  onClick={() => setSelected(new Set())}
                >
                  Nenhum
                </button>
              </div>
            </div>
            <ul className="max-h-64 overflow-auto space-y-1.5 pr-1">
              {insight.clientes.map((c) => (
                <ClientRow
                  key={c.user_id}
                  client={c}
                  selected={selected.has(c.user_id)}
                  onToggle={() => toggleClient(c.user_id)}
                />
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
            <button
              onClick={onDismiss}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
            >
              <Trash2 className="h-3 w-3" /> Descartar
            </button>
            <button
              onClick={dispatch}
              disabled={sending || !selected.size}
              className="inline-flex items-center gap-2 rounded-full bg-neon-pink px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Disparar campanha ({selected.size})
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function ClientRow({
  client,
  selected,
  onToggle,
}: {
  client: GrowthClient;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      onClick={onToggle}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2 text-xs transition",
        selected
          ? "border-neon-pink/40 bg-neon-pink/10"
          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]",
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        readOnly
        className="h-3.5 w-3.5 accent-neon-pink"
      />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white truncate">
          {client.name}
          {!client.phone && (
            <span className="ml-2 text-[10px] text-red-300">sem WhatsApp</span>
          )}
        </div>
        <div className="text-[11px] text-white/60 truncate">{client.reason}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[11px] text-white/70">LTV {brl(client.ltv)}</div>
        <div className="text-[10px] text-white/40">{client.orders} pedidos</div>
      </div>
    </li>
  );
}

// ---------------- Chat ----------------

type ChatMsg = { role: "user" | "assistant"; content: string };

function GrowthChatPanel() {
  const chatFn = useServerFn(growthChat);
  const historyFn = useServerFn(getGrowthChatHistory);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    historyFn({ data: undefined }).then((res) => {
      setMessages(
        (res.messages ?? [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, expanded]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await chatFn({ data: { message: text } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (e) {
      toast.error((e as Error).message);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Ops, não consegui responder. Tente de novo.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const reset = async () => {
    await chatFn({ data: { message: "Olá", reset: true } }).catch(() => null);
    setMessages([]);
    toast.success("Histórico limpo");
  };

  const suggestions = useMemo(
    () => [
      "Qual promo lançar essa semana?",
      "Ideia de push para hoje à noite",
      "Como recuperar clientes que sumiram?",
      "Que sabor destacar no fim de semana?",
    ],
    [],
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        <MessageSquare className="h-4 w-4 text-neon-yellow" />
        <span className="flex-1 font-semibold">Assistente de crescimento</span>
        <span className="text-xs text-white/50">
          {messages.length} mensagens
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-white/60" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/60" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-white/10 flex flex-col h-[520px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-sm text-white/60 py-6">
                <p>Pergunte qualquer coisa sobre marketing, cardápio, retenção ou operação.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-neon-pink text-white"
                      : "bg-white/10 text-white/90",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white/10 px-3 py-2 text-sm text-white/60">
                  <Loader2 className="inline h-3 w-3 animate-spin" /> pensando…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-white/10 p-3">
            <button
              onClick={reset}
              title="Limpar histórico"
              className="rounded-full border border-white/15 p-2 text-white/70 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Pergunte ao assistente…"
              className="flex-1 rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm outline-none focus:border-neon-yellow"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="rounded-full bg-neon-yellow p-2 text-black disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
