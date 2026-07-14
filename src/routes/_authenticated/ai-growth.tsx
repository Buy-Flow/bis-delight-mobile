import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  RefreshCw,
  TrendingUp,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Copy,
  Check,
  Wallet,
  AlertTriangle,
  Users,
  Zap,
  BrainCircuit,
  Trash2,
  Plus,
  MessageSquare,
  Globe,
  Menu,
  X,
  MoreVertical,
  Pencil,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useIsAdmin } from "@/lib/menu-data";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import {
  generateGrowthInsights,
  dismissGrowthInsight,
  dispatchGrowthCampaign,
  growthChat,
  listGrowthThreads,
  createGrowthThread,
  deleteGrowthThread,
  renameGrowthThread,
  getGrowthThreadMessages,
  type GrowthReport,
  type GrowthInsight,
  type GrowthClient,
  type GrowthThread,
  type GrowthChatMessage,
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

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <HeroCard
          report={report}
          loading={loading}
          onRefresh={() => load(true)}
        />

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

        <ConsultantChat />
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

// ============ Consultant Chat (threaded, advisory only) ============

const SUGGESTIONS = [
  "Quais tendências de açaí estão bombando esse mês?",
  "Como reduzir churn de clientes VIP?",
  "Ideias de combos para o inverno",
  "Que estratégia de mídia social usar para açaí premium?",
  "Benchmark de ticket médio no meu segmento",
  "Sugestões de sabores sazonais",
];

function ConsultantChat() {
  const listFn = useServerFn(listGrowthThreads);
  const createFn = useServerFn(createGrowthThread);
  const deleteFn = useServerFn(deleteGrowthThread);
  const renameFn = useServerFn(renameGrowthThread);
  const msgsFn = useServerFn(getGrowthThreadMessages);
  const chatFn = useServerFn(growthChat);

  const [threads, setThreads] = useState<GrowthThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GrowthChatMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId],
  );

  const refreshThreads = async (): Promise<GrowthThread[]> => {
    const res = await listFn({ data: undefined });
    setThreads(res.threads);
    return res.threads;
  };

  const loadMessages = async (tid: string) => {
    try {
      const res = await msgsFn({ data: { thread_id: tid } });
      setMessages(res.messages);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  useEffect(() => {
    (async () => {
      setLoadingThreads(true);
      try {
        let list = await refreshThreads();
        if (!list.length) {
          const res = await createFn({ data: {} });
          list = [res.thread];
          setThreads(list);
        }
        setActiveId(list[0].id);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoadingThreads(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const newThread = async () => {
    try {
      const res = await createFn({ data: {} });
      setThreads((t) => [res.thread, ...t]);
      setActiveId(res.thread.id);
      setMessages([]);
      setDrawerOpen(false);
      setTimeout(() => taRef.current?.focus(), 50);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeThread = async (id: string) => {
    if (!confirm("Apagar esta conversa?")) return;
    try {
      await deleteFn({ data: { id } });
      const next = threads.filter((t) => t.id !== id);
      setThreads(next);
      if (activeId === id) {
        if (next.length) setActiveId(next[0].id);
        else {
          const res = await createFn({ data: {} });
          setThreads([res.thread]);
          setActiveId(res.thread.id);
          setMessages([]);
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const rename = async (id: string) => {
    const cur = threads.find((t) => t.id === id);
    const next = prompt("Renomear conversa:", cur?.title ?? "")?.trim();
    if (!next) return;
    try {
      await renameFn({ data: { id, title: next.slice(0, 80) } });
      setThreads((t) =>
        t.map((x) => (x.id === id ? { ...x, title: next.slice(0, 80) } : x)),
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !activeId) return;
    setInput("");
    const optimistic: GrowthChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setSending(true);
    try {
      const res = await chatFn({
        data: {
          thread_id: activeId,
          message: text,
          web_search: webSearch,
        },
      });
      let reply = res.reply;
      if (res.citations?.length) {
        reply +=
          "\n\n**Fontes:**\n" +
          res.citations.map((u, i) => `${i + 1}. ${u}`).join("\n");
      }
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: reply,
          created_at: new Date().toISOString(),
        },
      ]);
      refreshThreads();
    } catch (e) {
      toast.error((e as Error).message);
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ ${(e as Error).message}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => taRef.current?.focus(), 50);
    }
  };

  const showEmpty = !messages.length && !sending;

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-purple-900/40 to-black/40 overflow-hidden">
      <div className="flex flex-col lg:flex-row h-[640px] lg:h-[680px]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:w-64 xl:w-72 shrink-0 flex-col border-r border-white/10 bg-black/30">
          <SidebarContent
            threads={threads}
            activeId={activeId}
            loading={loadingThreads}
            onSelect={(id) => setActiveId(id)}
            onNew={newThread}
            onDelete={removeThread}
            onRename={rename}
          />
        </aside>

        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 bg-black/20">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden rounded-lg p-2 hover:bg-white/10"
              aria-label="Conversas"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-neon-yellow shrink-0" />
                <span className="font-semibold truncate">
                  {active?.title ?? "Consultor de crescimento"}
                </span>
              </div>
              <div className="text-[11px] text-white/50 truncate">
                Consultor — só conversa e dá ideias, não altera o site.
              </div>
            </div>
            <button
              onClick={newThread}
              title="Nova conversa"
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {showEmpty && (
              <div className="max-w-lg mx-auto text-center py-8 space-y-4">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-neon-yellow/30 to-neon-pink/30 flex items-center justify-center">
                  <BrainCircuit className="h-7 w-7 text-neon-yellow" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    Consultor de crescimento
                  </h3>
                  <p className="text-sm text-white/60 mt-1">
                    Estratégia, tendências e ideias para o Quero Bis. Ative a
                    busca na web para consultar o mercado em tempo real.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-xs text-white/80 hover:bg-white/10 hover:border-neon-yellow/40 active:scale-[0.98] transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {sending && (
              <div className="flex items-start gap-2">
                <div className="h-7 w-7 rounded-full bg-neon-yellow/20 flex items-center justify-center shrink-0">
                  <BrainCircuit className="h-4 w-4 text-neon-yellow" />
                </div>
                <div className="rounded-2xl bg-white/5 px-3 py-2 text-sm text-white/60">
                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                  {webSearch ? "consultando mercado…" : "pensando…"}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-white/10 p-3 bg-black/30 space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWebSearch((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                  webSearch
                    ? "bg-neon-yellow text-black border-neon-yellow"
                    : "border-white/15 text-white/70 hover:bg-white/5",
                )}
                title="Buscar informações atualizadas na web"
              >
                <Globe className="h-3.5 w-3.5" />
                Web {webSearch ? "on" : "off"}
              </button>
              <span className="text-[10px] text-white/40 hidden sm:inline">
                {webSearch
                  ? "Respostas com fontes atualizadas"
                  : "Só conhecimento do modelo + KPIs da loja"}
              </span>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    window.matchMedia("(min-width: 768px)").matches
                  ) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Pergunte ao consultor…"
                rows={2}
                className="flex-1 resize-none rounded-2xl border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-neon-yellow"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="shrink-0 h-11 w-11 rounded-2xl bg-neon-yellow text-black hover:brightness-110 disabled:opacity-40 flex items-center justify-center"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="absolute inset-y-0 left-0 w-[85%] max-w-xs bg-purple-950 border-r border-white/10 flex flex-col animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <span className="font-semibold text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Conversas
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent
              threads={threads}
              activeId={activeId}
              loading={loadingThreads}
              onSelect={(id) => {
                setActiveId(id);
                setDrawerOpen(false);
              }}
              onNew={newThread}
              onDelete={removeThread}
              onRename={rename}
            />
          </aside>
        </div>
      )}
    </section>
  );
}

function SidebarContent({
  threads,
  activeId,
  loading,
  onSelect,
  onNew,
  onDelete,
  onRename,
}: {
  threads: GrowthThread[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
}) {
  return (
    <>
      <div className="p-3 border-b border-white/10">
        <button
          onClick={onNew}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-neon-yellow px-3 py-2 text-sm font-bold text-black hover:brightness-110 active:scale-[0.98] transition"
        >
          <Plus className="h-4 w-4" /> Nova conversa
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && (
          <div className="text-center text-xs text-white/50 py-4">
            <Loader2 className="inline h-3 w-3 animate-spin" /> carregando…
          </div>
        )}
        {!loading && !threads.length && (
          <div className="text-center text-xs text-white/50 py-4">
            Sem conversas ainda.
          </div>
        )}
        {threads.map((t) => (
          <ThreadRow
            key={t.id}
            thread={t}
            active={t.id === activeId}
            onSelect={() => onSelect(t.id)}
            onDelete={() => onDelete(t.id)}
            onRename={() => onRename(t.id)}
          />
        ))}
      </div>
    </>
  );
}

function ThreadRow({
  thread,
  active,
  onSelect,
  onDelete,
  onRename,
}: {
  thread: GrowthThread;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: () => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div
      className={cn(
        "group relative rounded-xl border transition",
        active
          ? "border-neon-yellow/40 bg-neon-yellow/10"
          : "border-transparent hover:border-white/10 hover:bg-white/5",
      )}
    >
      <button
        onClick={onSelect}
        className="w-full text-left px-3 py-2.5 flex items-center gap-2 min-w-0"
      >
        <MessageSquare
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            active ? "text-neon-yellow" : "text-white/50",
          )}
        />
        <span className="flex-1 truncate text-sm">{thread.title}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenu((v) => !v);
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {menu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenu(false)}
          />
          <div className="absolute right-1 top-9 z-50 min-w-[130px] rounded-lg border border-white/10 bg-purple-950 shadow-xl p-1">
            <button
              onClick={() => {
                setMenu(false);
                onRename();
              }}
              className="w-full text-left px-2 py-1.5 rounded text-xs text-white/80 hover:bg-white/10 flex items-center gap-2"
            >
              <Pencil className="h-3 w-3" /> Renomear
            </button>
            <button
              onClick={() => {
                setMenu(false);
                onDelete();
              }}
              className="w-full text-left px-2 py-1.5 rounded text-xs text-red-300 hover:bg-red-500/20 flex items-center gap-2"
            >
              <Trash2 className="h-3 w-3" /> Apagar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: GrowthChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-neon-yellow/20 flex items-center justify-center shrink-0 mt-0.5">
          <BrainCircuit className="h-4 w-4 text-neon-yellow" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
          isUser
            ? "bg-neon-pink text-white"
            : "bg-white/[0.06] border border-white/10 text-white/90",
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0 prose-a:text-neon-yellow prose-strong:text-white">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
