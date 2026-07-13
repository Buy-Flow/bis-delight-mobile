import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageCircle,
  Search,
  Send,
  Bot,
  BotOff,
  CheckCheck,
  Clock,
  AlertTriangle,
  Loader2,
  Sparkles,
  Filter,
  RefreshCw,
  Phone,
  ExternalLink,
  X,
  Inbox,
  Users,
  TrendingUp,
  Smartphone,
  ScrollText,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  sendWhatsappMessage,
  setAiPaused,
  markConversationRead,
  getWhatsappConfigStatus,
  syncWhatsappRecentMessages,
} from "@/lib/whatsapp.functions";
import { WhatsappConnectDialog } from "@/components/admin/WhatsappConnectDialog";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  component: WhatsappPage,
});

type Conversation = {
  id: string;
  phone: string;
  user_id: string | null;
  contact_name: string | null;
  profile_pic_url: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  ai_paused: boolean;
  assigned_to: string | null;
  created_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  evolution_id: string | null;
  direction: "in" | "out" | "inbound" | "outbound";
  type: string;
  content: string | null;
  media_url: string | null;
  transcript: string | null;
  sent_by: string | null;
  operator_id: string | null;
  status: string | null;
  read_at: string | null;
  error: string | null;
  created_at: string;
};

type FilterKey = "todas" | "nao_lidas" | "ia_pausada" | "hoje";

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay)
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 7)
    return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatPhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return p;
}

function initials(name: string | null, phone: string) {
  const src = (name || phone).trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(-2).toUpperCase();
}

function WhatsappPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todas");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [config, setConfig] = useState<{
    configured: boolean;
    hasBase: boolean;
    hasKey: boolean;
    hasInstance: boolean;
  } | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [tab, setTab] = useState<"inbox" | "logs">("inbox");
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);

  const sendFn = useServerFn(sendWhatsappMessage);
  const pauseFn = useServerFn(setAiPaused);
  const readFn = useServerFn(markConversationRead);
  const cfgFn = useServerFn(getWhatsappConfigStatus);
  const syncFn = useServerFn(syncWhatsappRecentMessages);

  const loadConversations = async () => {
    setLoadingList(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("whatsapp_conversations")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(300);
    if (error) toast.error("Erro ao carregar: " + error.message);
    setConversations((data ?? []) as Conversation[]);
    setLoadingList(false);
  };

  const loadMessages = async (id: string) => {
    setLoadingMsgs(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) toast.error("Erro nas mensagens: " + error.message);
    setMessages((data ?? []) as Message[]);
    setLoadingMsgs(false);
    // mark as read
    try {
      await readFn({ data: { id } });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)),
      );
    } catch {
      /* noop */
    }
  };

  const syncFromPhone = async (showToast = false) => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncing(true);
    try {
      const res = await syncFn({ data: { limit: 80 } });
      await loadConversations();
      const openId = selectedIdRef.current;
      if (openId) await loadMessages(openId);
      if (showToast) {
        toast.success(
          res.inserted > 0
            ? `${res.inserted} mensagem(ns) sincronizada(s) do telefone.`
            : "Telefone sincronizado. Nenhuma mensagem nova.",
        );
      }
    } catch (e) {
      if (showToast) toast.error(e instanceof Error ? e.message : "Erro ao sincronizar telefone");
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  };

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    loadConversations();
    cfgFn().then(setConfig).catch(() => setConfig(null));
    syncFromPhone(false);

    // realtime
    const ch = supabase
      .channel("wa-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        () => loadConversations(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            if (selectedIdRef.current !== m.conversation_id) return prev;
            return [...prev, m];
          });
        },
      )
      .subscribe();

    const syncTimer = window.setInterval(() => syncFromPhone(false), 30000);

    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(syncTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
    else setMessages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return conversations.filter((c) => {
      if (q) {
        const hay = `${c.contact_name ?? ""} ${c.phone} ${c.last_message_preview ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "nao_lidas" && (c.unread_count ?? 0) <= 0) return false;
      if (filter === "ia_pausada" && !c.ai_paused) return false;
      if (filter === "hoje") {
        if (!c.last_message_at) return false;
        if (new Date(c.last_message_at).getTime() < today.getTime()) return false;
      }
      return true;
    });
  }, [conversations, query, filter]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const total = conversations.length;
    const unread = conversations.reduce((s, c) => s + (c.unread_count ?? 0), 0);
    const active = conversations.filter(
      (c) => c.last_message_at && new Date(c.last_message_at).getTime() >= today.getTime(),
    ).length;
    const paused = conversations.filter((c) => c.ai_paused).length;
    return { total, unread, active, paused };
  }, [conversations]);

  const handleSend = async () => {
    if (!selectedId || !text.trim() || sending) return;
    setSending(true);
    try {
      const res = await sendFn({ data: { conversation_id: selectedId, text: text.trim() } });
      setText("");
      if (res.warning) toast.warning(res.warning);
      else toast.success("Mensagem enviada");
      await loadMessages(selectedId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const handleTogglePause = async () => {
    if (!selected) return;
    try {
      await pauseFn({ data: { id: selected.id, paused: !selected.ai_paused } });
      setConversations((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, ai_paused: !c.ai_paused } : c)),
      );
      toast.success(selected.ai_paused ? "IA reativada" : "IA pausada — atendimento humano");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div className="min-h-full bg-[#0e0a1a] pb-24 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-400/80">
              <Sparkles className="h-3 w-3" /> Central de atendimento
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              WhatsApp{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                dos clientes
              </span>
            </h1>
            <p className="mt-1 text-sm text-white/60">
              Converse em tempo real, pause a IA quando quiser assumir e transforme
              conversas em vendas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConnectOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/25"
            >
              <Smartphone className="h-3.5 w-3.5" /> Conectar telefone
            </button>
            <button
              onClick={() => syncFromPhone(true)}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sincronizar telefone
            </button>
          </div>
        </header>

        <WhatsappConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} />


        {/* Config warning */}
        {config && !config.configured && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <div className="font-bold">Evolution API não configurada</div>
              <div className="mt-0.5 text-amber-100/80">
                Defina{" "}
                {!config.hasBase && <code className="rounded bg-black/30 px-1">EVOLUTION_API_URL</code>}{" "}
                {!config.hasKey && <code className="rounded bg-black/30 px-1">EVOLUTION_API_KEY</code>}{" "}
                {!config.hasInstance && (
                  <code className="rounded bg-black/30 px-1">EVOLUTION_INSTANCE</code>
                )}{" "}
                nos secrets. O envio ficará indisponível até configurar; a leitura das
                conversas continua funcionando.
              </div>
            </div>
          </div>
        )}

        {/* KPIs */}
        <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi
            icon={<Inbox className="h-4 w-4" />}
            label="Conversas"
            value={String(kpis.total)}
            accent="from-emerald-400/30 to-emerald-500/10"
            iconColor="text-emerald-300"
          />
          <Kpi
            icon={<TrendingUp className="h-4 w-4" />}
            label="Ativas hoje"
            value={String(kpis.active)}
            accent="from-cyan-400/30 to-cyan-500/10"
            iconColor="text-cyan-300"
          />
          <Kpi
            icon={<MessageCircle className="h-4 w-4" />}
            label="Não lidas"
            value={String(kpis.unread)}
            accent="from-neon-pink/30 to-fuchsia-500/10"
            iconColor="text-neon-pink"
          />
          <Kpi
            icon={<Users className="h-4 w-4" />}
            label="Humano no comando"
            value={String(kpis.paused)}
            accent="from-yellow-400/30 to-yellow-500/10"
            iconColor="text-yellow-300"
          />
        </section>

        {/* Tabs */}
        <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-xs font-bold">
          <button
            onClick={() => setTab("inbox")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition",
              tab === "inbox" ? "bg-emerald-500/20 text-emerald-100" : "text-white/60 hover:text-white",
            )}
          >
            <Inbox className="h-3.5 w-3.5" /> Caixa de entrada
          </button>
          <button
            onClick={() => setTab("logs")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition",
              tab === "logs" ? "bg-emerald-500/20 text-emerald-100" : "text-white/60 hover:text-white",
            )}
          >
            <ScrollText className="h-3.5 w-3.5" /> Logs de ingestão
          </button>
        </div>

        {tab === "logs" ? (
          <LogsPanel />
        ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[380px_1fr]">
          {/* Conversations list */}
          <aside className="flex h-[70vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome, telefone…"
                  className="w-full rounded-full border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip active={filter === "todas"} onClick={() => setFilter("todas")}>
                  <Filter className="h-3 w-3" /> Todas
                </Chip>
                <Chip
                  active={filter === "nao_lidas"}
                  onClick={() => setFilter("nao_lidas")}
                >
                  Não lidas
                </Chip>
                <Chip active={filter === "hoje"} onClick={() => setFilter("hoje")}>
                  Hoje
                </Chip>
                <Chip
                  active={filter === "ia_pausada"}
                  onClick={() => setFilter("ia_pausada")}
                >
                  <BotOff className="h-3 w-3" /> IA pausada
                </Chip>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingList ? (
                <div className="flex h-full items-center justify-center text-white/40">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-white/50">
                  <Inbox className="h-8 w-8 text-white/20" />
                  <div>Nenhuma conversa encontrada.</div>
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {filtered.map((c) => {
                    const active = c.id === selectedId;
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => setSelectedId(c.id)}
                          className={cn(
                            "flex w-full items-start gap-3 px-3 py-3 text-left transition",
                            active
                              ? "bg-emerald-500/10"
                              : "hover:bg-white/[0.04]",
                          )}
                        >
                          <Avatar name={c.contact_name} phone={c.phone} pic={c.profile_pic_url} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1 truncate text-sm font-bold text-white">
                                {c.contact_name || formatPhone(c.phone)}
                              </div>
                              <div className="shrink-0 text-[10px] font-bold text-white/40">
                                {formatTime(c.last_message_at)}
                              </div>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              <div className="min-w-0 flex-1 truncate text-xs text-white/60">
                                {c.last_message_preview || "—"}
                              </div>
                              {c.ai_paused && (
                                <BotOff
                                  className="h-3 w-3 shrink-0 text-yellow-300"
                                />
                              )}
                              {c.unread_count > 0 && (
                                <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-black text-black">
                                  {c.unread_count > 99 ? "99+" : c.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Chat panel */}
          <section className="flex h-[70vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white/50">
                <MessageCircle className="h-10 w-10 text-white/20" />
                <div className="text-sm">Selecione uma conversa para começar</div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-white/10 bg-black/20 p-3">
                  <Avatar
                    name={selected.contact_name}
                    phone={selected.phone}
                    pic={selected.profile_pic_url}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">
                      {selected.contact_name || formatPhone(selected.phone)}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-white/50">
                      <Phone className="h-3 w-3" />
                      {formatPhone(selected.phone)}
                    </div>
                  </div>
                  <button
                    onClick={handleTogglePause}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
                      selected.ai_paused
                        ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-200 hover:bg-yellow-400/20"
                        : "border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20",
                    )}
                    title={selected.ai_paused ? "IA pausada — humano" : "IA respondendo"}
                  >
                    {selected.ai_paused ? (
                      <>
                        <BotOff className="h-3 w-3" /> Humano
                      </>
                    ) : (
                      <>
                        <Bot className="h-3 w-3" /> IA
                      </>
                    )}
                  </button>
                  <a
                    href={`https://wa.me/${selected.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
                    title="Abrir no WhatsApp Web"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 lg:hidden"
                    title="Fechar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Messages */}
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto bg-gradient-to-b from-[#0a0715] to-[#0e0a1a] p-4"
                >
                  {loadingMsgs ? (
                    <div className="flex h-full items-center justify-center text-white/40">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-white/40">
                      Sem mensagens ainda.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {groupByDay(messages).map((group) => (
                        <div key={group.day}>
                          <div className="my-3 flex justify-center">
                            <div className="rounded-full bg-black/40 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
                              {group.day}
                            </div>
                          </div>
                          {group.items.map((m) => (
                            <MessageBubble key={m.id} m={m} />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Composer */}
                <div className="border-t border-white/10 bg-black/20 p-3">
                  {!selected.ai_paused && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-200">
                      <Bot className="h-3 w-3" />
                      IA está respondendo — envie manualmente ou pause a IA para assumir.
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      rows={2}
                      placeholder="Digite sua mensagem… (Enter envia, Shift+Enter quebra linha)"
                      className="flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-400 focus:outline-none"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!text.trim() || sending}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-black transition hover:brightness-110 disabled:opacity-40"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {QUICK_REPLIES.map((q) => (
                      <button
                        key={q}
                        onClick={() => setText((t) => (t ? t + " " + q : q))}
                        className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
        )}
      </div>
    </div>
  );
}

const QUICK_REPLIES = [
  "Oi! Como posso te ajudar? 🍫",
  "Seu pedido está a caminho 🛵",
  "Pode me confirmar o endereço?",
  "Obrigado pela preferência! ❤️",
  "Trabalhamos de terça a domingo, 18h-23h.",
];

function groupByDay(items: Message[]) {
  const map = new Map<string, Message[]>();
  for (const m of items) {
    const d = new Date(m.created_at);
    const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
}

function MessageBubble({ m }: { m: Message }) {
  const out = m.direction === "outbound" || m.direction === "out";
  const isAi = m.sent_by === "ai";
  const failed = m.status === "failed";
  const pending = m.status === "pending";
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start", "mb-1")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          out
            ? isAi
              ? "bg-gradient-to-br from-purple-500/30 to-fuchsia-500/20 border border-purple-400/30 text-white"
              : "bg-emerald-500/90 text-black"
            : "bg-white/10 text-white border border-white/10",
        )}
      >
        {isAi && (
          <div className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-purple-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
            <Sparkles className="h-2.5 w-2.5" /> IA
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">
          {m.content || (m.transcript ? `🎤 ${m.transcript}` : `[${m.type}]`)}
        </div>
        {m.media_url && (
          <a
            href={m.media_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block text-[11px] underline opacity-80"
          >
            Ver mídia
          </a>
        )}
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            out && !isAi ? "text-black/60" : "text-white/50",
          )}
        >
          {failed && <AlertTriangle className="h-3 w-3 text-red-400" />}
          {pending && <Clock className="h-3 w-3" />}
          <span>
            {new Date(m.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {out && !failed && !pending && <CheckCheck className="h-3 w-3" />}
        </div>
        {failed && m.error && (
          <div className="mt-1 text-[10px] text-red-300">{m.error.slice(0, 120)}</div>
        )}
      </div>
    </div>
  );
}

function Avatar({
  name,
  phone,
  pic,
}: {
  name: string | null;
  phone: string;
  pic: string | null;
}) {
  if (pic) {
    return (
      <img
        src={pic}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full border border-white/10 object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-xs font-black text-black">
      {initials(name, phone)}
    </div>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition",
        active
          ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-100"
          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  iconColor: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-4",
        accent,
      )}
    >
      <div className={cn("mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest", iconColor)}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-black tabular-nums text-white">{value}</div>
    </div>
  );
}
