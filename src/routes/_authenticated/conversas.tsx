import { createFileRoute } from "@tanstack/react-router";
import { AdminNavMenu } from "@/components/admin/AdminNavMenu";
import { Toaster, toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Loader2, Send, Bot, User as UserIcon, PhoneCall, Search, PauseCircle, PlayCircle, QrCode, RefreshCw, Wifi, WifiOff, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/menu-data";
import {
  sendWhatsappMessage,
  toggleConversationAi,
  markConversationRead,
  getEvolutionStatus,
  getEvolutionConnectionState,
  resetEvolutionInstance,
  configureEvolutionWebhook,
} from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/conversas")({
  head: () => ({
    meta: [
      { title: "Conversas — CRM WhatsApp Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConversasPage,
});

type Conversation = {
  id: string;
  phone: string;
  contact_name: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  ai_paused: boolean;
  user_id: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  type: string;
  content: string | null;
  media_url: string | null;
  sent_by: string;
  created_at: string;
  status: string | null;
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function initials(name: string | null, phone: string) {
  const src = name || phone;
  const parts = src.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase().slice(0, 2);
}

function ConversasPage() {
  const { data: isAdmin, isLoading } = useIsAdmin();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "ai" | "human">("all");
  const [search, setSearch] = useState("");
  const [showConnect, setShowConnect] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendFn = useServerFn(sendWhatsappMessage);
  const toggleFn = useServerFn(toggleConversationAi);
  const markReadFn = useServerFn(markConversationRead);

  // Load conversations
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoadingConv(true);
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("id, phone, contact_name, last_message_at, last_message_preview, unread_count, ai_paused, user_id")
        .order("last_message_at", { ascending: false })
        .limit(200);
      if (error) toast.error("Erro ao carregar conversas");
      setConversations((data ?? []) as Conversation[]);
      setLoadingConv(false);
    })();

    const channel = supabase
      .channel("wa-conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        (payload) => {
          setConversations((prev) => {
            const row = payload.new as Conversation;
            if (payload.eventType === "DELETE") {
              return prev.filter((c) => c.id !== (payload.old as any).id);
            }
            const without = prev.filter((c) => c.id !== row.id);
            return [row, ...without].sort(
              (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
            );
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    (async () => {
      setLoadingMsgs(true);
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("id, conversation_id, direction, type, content, media_url, sent_by, created_at, status")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) toast.error("Erro ao carregar mensagens");
      setMessages((data ?? []) as Message[]);
      setLoadingMsgs(false);
    })();

    // Mark read
    markReadFn({ data: { conversationId: selectedId } }).catch(() => {});

    const channel = supabase
      .channel(`wa-msgs-${selectedId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId, markReadFn]);

  // Autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === "unread") list = list.filter((c) => c.unread_count > 0);
    if (filter === "ai") list = list.filter((c) => !c.ai_paused);
    if (filter === "human") list = list.filter((c) => c.ai_paused);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.contact_name ?? "").toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.last_message_preview ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [conversations, filter, search]);

  const handleSend = async () => {
    if (!selected || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);
    try {
      await sendFn({ data: { conversationId: selected.id, text } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const handleToggleAi = async () => {
    if (!selected) return;
    try {
      await toggleFn({ data: { conversationId: selected.id, paused: !selected.ai_paused } });
      toast.success(selected.ai_paused ? "IA reativada nessa conversa" : "Você assumiu a conversa");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.10_0.08_300)] text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.10_0.08_300)] px-4 text-white">
        <p>Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[oklch(0.10_0.08_300)] text-white">
      <Toaster position="bottom-center" theme="dark" closeButton />

      <header className="shrink-0 border-b border-purple-900/50 bg-[oklch(0.10_0.08_300)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-neon-yellow" />
            <span
              className="text-xl font-black uppercase text-neon-yellow"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              Conversas
            </span>
            <button
              onClick={() => setShowConnect(true)}
              className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/70 hover:text-white"
              title="Conectar WhatsApp"
            >
              <QrCode className="h-3 w-3" /> Conectar
            </button>
          </div>
          <AdminNavMenu />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-3 overflow-hidden p-3">
        {/* Sidebar: conversations */}
        <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar…"
                className="w-full rounded-full border border-white/10 bg-black/20 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/40 focus:border-neon-pink focus:outline-none"
              />
            </div>
            <div className="mt-2 flex gap-1 text-[10px]">
              {(["all", "unread", "ai", "human"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-2 py-1 font-semibold transition ${
                    filter === f
                      ? "bg-neon-yellow text-[oklch(0.15_0.10_305)]"
                      : "bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  {f === "all" ? "Todas" : f === "unread" ? "Não lidas" : f === "ai" ? "IA" : "Humano"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConv ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-4 w-4 animate-spin text-white/40" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-white/40">
                Nenhuma conversa ainda.
                <br />
                As mensagens do WhatsApp aparecem aqui.
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-start gap-2.5 border-b border-white/5 px-3 py-2.5 text-left transition hover:bg-white/5 ${
                    selectedId === c.id ? "bg-neon-pink/10" : ""
                  }`}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neon-pink to-purple-600 text-[10px] font-bold">
                    {initials(c.contact_name, c.phone)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-bold text-white">
                        {c.contact_name || c.phone}
                      </span>
                      <span className="text-[9px] text-white/40">{fmtTime(c.last_message_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[11px] text-white/60">
                        {c.last_message_preview ?? ""}
                      </span>
                      {c.unread_count > 0 && (
                        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-neon-pink px-1 text-[9px] font-bold">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      {c.ai_paused ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                          <UserIcon className="h-2 w-2" /> humano
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-neon-cyan/20 px-1.5 py-0.5 text-[9px] font-semibold text-neon-cyan">
                          <Bot className="h-2 w-2" /> IA
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Chat pane */}
        <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {selected ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-neon-pink to-purple-600 text-xs font-bold">
                    {initials(selected.contact_name, selected.phone)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      {selected.contact_name || selected.phone}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-white/50">
                      <PhoneCall className="h-2.5 w-2.5" /> {selected.phone}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleToggleAi}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    selected.ai_paused
                      ? "bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30"
                      : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                  }`}
                >
                  {selected.ai_paused ? (
                    <>
                      <PlayCircle className="h-3.5 w-3.5" /> Devolver pra IA
                    </>
                  ) : (
                    <>
                      <PauseCircle className="h-3.5 w-3.5" /> Assumir conversa
                    </>
                  )}
                </button>
              </div>

              <div
                ref={scrollRef}
                className="flex-1 space-y-1.5 overflow-y-auto bg-[oklch(0.08_0.06_300)] px-4 py-4"
              >
                {loadingMsgs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="mt-10 text-center text-xs text-white/40">
                    Envie a primeira mensagem para começar a conversa.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isOut = m.direction === "out";
                    const bubble =
                      m.sent_by === "ai"
                        ? "bg-neon-cyan/20 text-white border border-neon-cyan/30"
                        : isOut
                        ? "bg-[#005c4b] text-white"
                        : "bg-white/10 text-white";
                    return (
                      <div key={m.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${bubble}`}
                        >
                          {m.sent_by === "ai" && (
                            <div className="mb-0.5 flex items-center gap-1 text-[10px] font-bold text-neon-cyan">
                              <Bot className="h-2.5 w-2.5" /> IA
                            </div>
                          )}
                          {m.type === "image" && m.media_url ? (
                            <img src={m.media_url} alt="" className="mb-1 max-h-64 rounded-lg" />
                          ) : null}
                          {m.type === "audio" && m.media_url ? (
                            <audio controls src={m.media_url} className="my-1 max-w-[240px]" />
                          ) : null}
                          {m.content && <div className="whitespace-pre-wrap break-words">{m.content}</div>}
                          <div className="mt-0.5 text-[9px] text-white/40">
                            {fmtTime(m.created_at)}
                            {m.status === "failed" ? " · falhou" : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="shrink-0 border-t border-white/10 bg-[oklch(0.10_0.08_300)] p-3">
                {!selected.ai_paused && (
                  <div className="mb-2 rounded-lg border border-neon-cyan/20 bg-neon-cyan/5 px-3 py-1.5 text-[10px] text-neon-cyan">
                    <Bot className="mr-1 inline h-3 w-3" /> IA está respondendo essa conversa.
                    Clique em "Assumir" pra pausar e responder você.
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Digite sua mensagem…"
                    rows={2}
                    className="flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-neon-pink focus:outline-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    className="inline-flex items-center gap-1.5 self-end rounded-full bg-neon-pink px-4 py-2 text-sm font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-40"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Enviar
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <MessageCircle className="mx-auto h-10 w-10 text-white/20" />
                <p className="mt-3 text-sm text-white/40">Selecione uma conversa</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {showConnect && <ConnectModal onClose={() => setShowConnect(false)} />}
    </div>
  );
}

function ConnectModal({ onClose }: { onClose: () => void }) {
  const statusFn = useServerFn(getEvolutionStatus);
  const pollStateFn = useServerFn(getEvolutionConnectionState);
  const resetFn = useServerFn(resetEvolutionInstance);
  const webhookFn = useServerFn(configureEvolutionWebhook);
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [qrLoadedAt, setQrLoadedAt] = useState<number | null>(null);
  const [webhookUrl] = useState(
    typeof window !== "undefined" ? `${window.location.origin}/api/public/evolution` : "",
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await statusFn();
      setState(res);
      setQrLoadedAt(Date.now());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao consultar Evolution");
    } finally {
      setLoading(false);
    }
  };

  const pollConnection = async () => {
    try {
      const res = await pollStateFn();
      const connected = res?.state?.instance?.state === "open" || res?.state?.state === "open";
      if (connected) setState(res);
    } catch {
      /* keep the QR visible while waiting */
    }
  };

  const resetConnection = async () => {
    setResetting(true);
    try {
      const res = await resetFn();
      setState(res);
      setQrLoadedAt(Date.now());
      toast.success("Conexão recriada. Escaneie o novo QR code.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao recriar conexão");
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(pollConnection, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!qrLoadedAt) return;
    const t = window.setTimeout(load, 55_000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrLoadedAt]);

  const isConnected =
    state?.state?.instance?.state === "open" || state?.state?.state === "open";
  const qrBase64: string | undefined =
    state?.state?.qrcode?.base64 ?? state?.state?.base64 ?? state?.state?.qr;

  const saveWebhook = async () => {
    try {
      await webhookFn({ data: { webhookUrl } });
      toast.success("Webhook configurado! A Evolution vai enviar as mensagens pro site.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[oklch(0.13_0.09_300)] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-white">Conectar WhatsApp</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            ✕
          </button>
        </div>

        {loading && !state ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : isConnected ? (
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Wifi className="h-7 w-7" />
            </div>
            <p className="mt-3 text-sm font-bold text-white">WhatsApp conectado!</p>
            <p className="mt-1 text-xs text-white/50">
              A instância <span className="font-mono">querobis</span> está online.
            </p>
          </div>
        ) : qrBase64 ? (
          <div className="text-center">
            <p className="mb-3 text-xs text-white/70">
              Abra o WhatsApp no celular → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> e leia o QR:
            </p>
            <img
              src={qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`}
              alt="QR code"
              className="mx-auto h-56 w-56 rounded-lg bg-white p-2"
            />
            <p className="mt-3 text-[10px] text-white/40">
              Verificando conexão a cada 5s. Se o WhatsApp rejeitar, toque em Recriar conexão.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10 disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" /> Novo QR
              </button>
              <button
                onClick={resetConnection}
                disabled={resetting}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
              >
                {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <WifiOff className="h-3 w-3" />}
                Recriar conexão
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-500/20 text-amber-400">
              <WifiOff className="h-7 w-7" />
            </div>
            <p className="mt-3 text-sm text-white/70">
              Aguardando QR code da Evolution…
            </p>
            <button
              onClick={load}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
            >
              <RefreshCw className="h-3 w-3" /> Tentar de novo
            </button>
            <button
              onClick={resetConnection}
              disabled={resetting}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
            >
              {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <WifiOff className="h-3 w-3" />}
              Recriar conexão
            </button>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Webhook (uma vez só)
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-black/40 px-2 py-1 text-[10px] text-neon-yellow">
              {webhookUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                toast.success("Copiado");
              }}
              className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/60 hover:text-white"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
          <button
            onClick={saveWebhook}
            className="mt-2 w-full rounded-full bg-neon-pink px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"
          >
            Configurar webhook na Evolution
          </button>
        </div>
      </div>
    </div>
  );
}
