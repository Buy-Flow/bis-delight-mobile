import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  BotOff,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings,
  Smartphone,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { WhatsappConnectDialog } from "@/components/admin/WhatsappConnectDialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  configureWhatsappWebhook,
  createWhatsappConversation,
  getWhatsappConfigStatus,
  getWhatsappConnectionState,
  markConversationRead,
  repairWhatsappConnection,
  sendWhatsappMessage,
  setAiPaused,
  syncWhatsappRecentMessages,
  updateWhatsappConversationPhone,
} from "@/lib/whatsapp.functions";

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
  _optimistic?: boolean;
};

type ConfigStatus = {
  configured: boolean;
  fullyConfigured?: boolean;
  hasBase: boolean;
  hasKey: boolean;
  hasInstance: boolean;
  hasToken?: boolean;
  instance?: string;
};

type ConnectionState = {
  state: string;
  exists: boolean;
  ownerJid: string | null;
  profileName: string | null;
  disconnectionAt: string | null;
  disconnectionCode: number | null;
};

type FilterKey = "todas" | "nao_lidas" | "ia_pausada" | "hoje";

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const diffDays = (now.getTime() - d.getTime()) / 86_400_000;
  if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("55") && (local.length === 12 || local.length === 13)) local = local.slice(2);
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

function initials(name: string | null, phone: string) {
  const src = (name || phone).trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return src.slice(-2).toUpperCase();
}

function isInbound(message: Message) {
  return message.direction === "in" || message.direction === "inbound";
}

function statusMeta(message: Message) {
  const status = (message.status ?? "").toLowerCase();
  if (message.error || status === "failed" || status === "error") {
    return { icon: AlertTriangle, className: "text-red-300" };
  }
  if (message.read_at || status === "read") return { icon: CheckCheck, className: "text-sky-300" };
  if (status === "delivered") return { icon: CheckCheck, className: "text-white/70" };
  if (status === "sending") return { icon: Clock, className: "text-white/50" };
  return { icon: Check, className: "text-white/60" };
}

function WhatsappPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todas");
  const [text, setText] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");

  const selectedIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const syncInFlightRef = useRef(false);

  const sendFn = useServerFn(sendWhatsappMessage);
  const pauseFn = useServerFn(setAiPaused);
  const readFn = useServerFn(markConversationRead);
  const cfgFn = useServerFn(getWhatsappConfigStatus);
  const stateFn = useServerFn(getWhatsappConnectionState);
  const syncFn = useServerFn(syncWhatsappRecentMessages);
  const createFn = useServerFn(createWhatsappConversation);
  const phoneFn = useServerFn(updateWhatsappConversationPhone);
  const webhookFn = useServerFn(configureWhatsappWebhook);
  const repairFn = useServerFn(repairWhatsappConnection);

  const selected = useMemo(() => conversations.find((conversation) => conversation.id === selectedId) ?? null, [conversations, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return conversations.filter((conversation) => {
      if (q) {
        const haystack = `${conversation.contact_name ?? ""} ${conversation.phone} ${conversation.last_message_preview ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filter === "nao_lidas" && conversation.unread_count <= 0) return false;
      if (filter === "ia_pausada" && !conversation.ai_paused) return false;
      if (filter === "hoje" && (!conversation.last_message_at || new Date(conversation.last_message_at).getTime() < today.getTime())) return false;
      return true;
    });
  }, [conversations, filter, query]);

  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      total: conversations.length,
      unread: conversations.reduce((sum, item) => sum + (item.unread_count ?? 0), 0),
      today: conversations.filter((item) => item.last_message_at && new Date(item.last_message_at).getTime() >= today.getTime()).length,
      paused: conversations.filter((item) => item.ai_paused).length,
    };
  }, [conversations]);

  async function loadConversations() {
    setLoadingList(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("whatsapp_conversations")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(300);
    if (error) toast.error(`Erro ao carregar conversas: ${error.message}`);
    setConversations((data ?? []) as Conversation[]);
    setLoadingList(false);
  }

  async function loadMessages(conversationId: string) {
    setLoadingMessages(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) toast.error(`Erro ao carregar mensagens: ${error.message}`);
    setMessages((data ?? []) as Message[]);
    setLoadingMessages(false);
    try {
      await readFn({ data: { id: conversationId } });
      setConversations((prev) => prev.map((item) => (item.id === conversationId ? { ...item, unread_count: 0 } : item)));
    } catch {
      // não bloqueia a conversa
    }
  }

  function loadConfigAndState() {
    cfgFn().then((value) => setConfig(value as ConfigStatus)).catch(() => setConfig(null));
    stateFn().then((value) => setConnection(value as ConnectionState)).catch(() => setConnection(null));
  }

  async function syncFromPhone(showToast = false) {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncing(true);
    try {
      const result = (await syncFn({ data: { limit: 80 } })) as { inserted?: number; updated?: number };
      await loadConversations();
      if (selectedIdRef.current) await loadMessages(selectedIdRef.current);
      if (showToast) {
        const total = (result.inserted ?? 0) + (result.updated ?? 0);
        toast.success(total > 0 ? `${total} mensagem(ns) sincronizada(s).` : "Sincronizado. Nenhuma mensagem nova.");
      }
    } catch (error) {
      if (showToast) toast.error(error instanceof Error ? error.message : "Erro ao sincronizar telefone");
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  }

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    loadConversations();
    loadConfigAndState();
    syncFromPhone(false);
    const stateTimer = window.setInterval(loadConfigAndState, 30_000);
    const channel = supabase
      .channel(`whatsapp-page-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => loadConversations())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, (payload) => {
        const message = payload.new as Message;
        if (selectedIdRef.current === message.conversation_id) {
          setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "whatsapp_messages" }, (payload) => {
        const message = payload.new as Message;
        setMessages((prev) => prev.map((item) => (item.id === message.id ? message : item)));
      })
      .subscribe();
    return () => {
      window.clearInterval(stateTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
    else setMessages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    setPhoneDraft(selected?.phone ?? "");
    setEditingPhone(false);
  }, [selected?.id, selected?.phone]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, selectedId]);

  async function handleCreateConversation() {
    if (!newPhone.trim()) return;
    try {
      const result = (await createFn({ data: { phone: newPhone, name: newName || undefined } })) as { conversation: Conversation };
      setNewName("");
      setNewPhone("");
      setNewOpen(false);
      await loadConversations();
      setSelectedId(result.conversation.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar conversa");
    }
  }

  async function handleSend() {
    if (!selectedId || !text.trim() || sending) return;
    const body = text.trim();
    const tempId = `local-${crypto.randomUUID()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: selectedId,
      evolution_id: null,
      direction: "out",
      type: "text",
      content: body,
      media_url: null,
      transcript: null,
      sent_by: "human",
      operator_id: null,
      status: "sending",
      read_at: null,
      error: null,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setSending(true);
    setText("");
    setMessages((prev) => [...prev, optimistic]);
    try {
      const result = (await sendFn({ data: { conversation_id: selectedId, text: body } })) as { message?: Message; warning?: string | null };
      const persisted = result.message ?? null;
      setMessages((prev) => {
        const withoutTemp = prev.filter((item) => item.id !== tempId);
        return persisted && !withoutTemp.some((item) => item.id === persisted.id) ? [...withoutTemp, persisted] : withoutTemp;
      });
      await loadConversations();
      if (persisted?.error) toast.error("Mensagem não enviada. Toque no balão para ver o erro.");
      else if (result.warning) toast.warning(result.warning);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao enviar mensagem";
      setMessages((prev) => prev.map((item) => (item.id === tempId ? { ...item, status: "failed", error: message } : item)));
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  async function handleToggleAi() {
    if (!selected) return;
    const paused = !selected.ai_paused;
    setConversations((prev) => prev.map((item) => (item.id === selected.id ? { ...item, ai_paused: paused } : item)));
    try {
      await pauseFn({ data: { id: selected.id, paused } });
    } catch (error) {
      setConversations((prev) => prev.map((item) => (item.id === selected.id ? { ...item, ai_paused: !paused } : item)));
      toast.error(error instanceof Error ? error.message : "Erro ao alterar IA");
    }
  }

  async function handleSavePhone() {
    if (!selected || !phoneDraft.trim()) return;
    try {
      const result = (await phoneFn({ data: { id: selected.id, phone: phoneDraft } })) as { id: string; phone: string; merged: boolean };
      setEditingPhone(false);
      await loadConversations();
      setSelectedId(result.id);
      toast.success(result.merged ? "Conversa mesclada com número existente." : "Número atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar número");
    }
  }

  async function handleConfigureWebhook() {
    setWebhookSaving(true);
    try {
      await webhookFn();
      loadConfigAndState();
      toast.success("Webhook configurado. As mensagens novas chegam em tempo real.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao configurar webhook");
    } finally {
      setWebhookSaving(false);
    }
  }

  async function handleRepairConnection() {
    setRepairing(true);
    try {
      await repairFn();
      loadConfigAndState();
      await syncFromPhone(false);
      toast.success("Conexão reparada. Aguarde alguns segundos e teste o envio novamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao reparar conexão");
    } finally {
      setRepairing(false);
    }
  }

  const connected = connection?.state === "open";

  return (
    <AdminShell>
      <div className="h-[calc(100dvh-3.5rem)] w-full min-w-0 overflow-hidden bg-[#0b141a] text-white">
        <div className="flex h-full w-full min-w-0">
          <aside className={cn(
            "flex min-w-0 flex-col border-r border-white/10 bg-[#111b21]",
            selected ? "hidden md:flex md:w-[340px] md:shrink-0 lg:w-[360px]" : "flex w-full md:w-[340px] md:shrink-0 lg:w-[360px]"
          )}>
            <div className="border-b border-white/10 bg-[#202c33] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-lg font-bold">
                    <MessageCircle className="h-5 w-5 text-emerald-400" />
                    WhatsApp
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-white/55">
                    {connected ? <Wifi className="h-3.5 w-3.5 text-emerald-400" /> : <WifiOff className="h-3.5 w-3.5 text-red-300" />}
                    <span>{connected ? "Conectado" : `Estado: ${connection?.state ?? "carregando"}`}</span>
                    {config?.instance && <span>· {config.instance}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setNewOpen(true)} className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white" aria-label="Nova conversa">
                    <Plus className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setConnectOpen(true)} className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white" aria-label="Configurar conexão">
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                <Kpi label="Conversas" value={kpis.total} />
                <Kpi label="Não lidas" value={kpis.unread} accent={kpis.unread > 0} />
                <Kpi label="Hoje" value={kpis.today} />
                <Kpi label="IA pausa" value={kpis.paused} />
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#0b141a] px-3 py-2">
                <Search className="h-4 w-4 text-white/45" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar conversa" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35" />
                {query && (
                  <button type="button" onClick={() => setQuery("")} className="text-white/45 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {[
                  ["todas", "Todas"],
                  ["nao_lidas", "Não lidas"],
                  ["hoje", "Hoje"],
                  ["ia_pausada", "IA pausada"],
                ].map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setFilter(key as FilterKey)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition", filter === key ? "bg-emerald-500 text-[#06140f]" : "bg-white/5 text-white/65 hover:bg-white/10 hover:text-white")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {!connected && (
              <div className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div>
                    WhatsApp fora do ar. Conecte a instância antes de enviar mensagens.
                    <button type="button" onClick={() => setConnectOpen(true)} className="ml-2 font-bold text-amber-200 underline">
                      Conectar
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-white/45">
              <span>{filtered.length} conversa(s)</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleConfigureWebhook} disabled={webhookSaving} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50">
                  {webhookSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                  webhook
                </button>
                <button type="button" onClick={handleRepairConnection} disabled={repairing} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50">
                  {repairing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                  reparar
                </button>
                <button type="button" onClick={() => syncFromPhone(true)} disabled={syncing} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50">
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  sync
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingList ? (
                <ConversationSkeleton />
              ) : filtered.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-white/45">Nenhuma conversa encontrada.</div>
              ) : (
                filtered.map((conversation) => (
                  <button key={conversation.id} type="button" onClick={() => setSelectedId(conversation.id)} className={cn("flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5", selectedId === conversation.id && "bg-[#2a3942]")}>
                    <Avatar conversation={conversation} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-white">{conversation.contact_name || formatPhone(conversation.phone)}</span>
                        {conversation.ai_paused && <BotOff className="h-3.5 w-3.5 text-amber-300" />}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-white/45">{conversation.last_message_preview || formatPhone(conversation.phone)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[11px] text-white/40">{formatTime(conversation.last_message_at)}</span>
                      {conversation.unread_count > 0 && <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-emerald-400 px-1.5 text-[11px] font-black text-[#06140f]">{conversation.unread_count}</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <main className={cn("min-w-0 flex-1 flex-col bg-[#0b141a]", selected ? "flex" : "hidden md:flex")}>
            {selected ? (
              <>
                <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-[#202c33] px-3">
                  <button type="button" onClick={() => setSelectedId(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white md:hidden" aria-label="Voltar">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <Avatar conversation={selected} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{selected.contact_name || formatPhone(selected.phone)}</div>
                    {editingPhone ? (
                      <div className="mt-1 flex items-center gap-2">
                        <input value={phoneDraft} onChange={(event) => setPhoneDraft(event.target.value)} className="h-7 w-52 rounded bg-[#111b21] px-2 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-emerald-400/50" />
                        <button type="button" onClick={handleSavePhone} className="rounded bg-emerald-500 px-2 py-1 text-xs font-bold text-[#06140f]">Salvar</button>
                        <button type="button" onClick={() => setEditingPhone(false)} className="text-xs text-white/55 hover:text-white">Cancelar</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setEditingPhone(true)} className="mt-0.5 flex items-center gap-1 text-xs text-white/45 hover:text-white/75">
                        <Phone className="h-3 w-3" /> {formatPhone(selected.phone)}
                      </button>
                    )}
                  </div>
                  <button type="button" onClick={handleToggleAi} className={cn("inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition", selected.ai_paused ? "bg-amber-400/15 text-amber-200 hover:bg-amber-400/25" : "bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25")}>
                    {selected.ai_paused ? <BotOff className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    {selected.ai_paused ? "IA pausada" : "IA ativa"}
                  </button>
                </div>

                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(32,44,51,0.9),_transparent_35%),#0b141a] px-4 py-5">
                  <div className="mx-auto flex max-w-4xl flex-col gap-2">
                    {loadingMessages ? <MessageSkeleton /> : messages.length === 0 ? <EmptyChat /> : messages.map((message) => <MessageBubble key={message.id} message={message} />)}
                  </div>
                </div>

                <div className="shrink-0 border-t border-white/10 bg-[#202c33] p-3">
                  <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); handleSend(); }}>
                    <textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={connected ? "Digite uma mensagem" : "Conecte o WhatsApp para enviar"}
                      rows={1}
                      disabled={!connected || sending}
                      className="max-h-32 min-h-11 flex-1 resize-none rounded-lg bg-[#2a3942] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 disabled:opacity-60"
                    />
                    <button type="submit" disabled={!connected || !text.trim() || sending} className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500 text-[#06140f] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30" aria-label="Enviar mensagem">
                      {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div className="max-w-sm px-6">
                  <Smartphone className="mx-auto mb-4 h-16 w-16 text-white/20" />
                  <h1 className="text-xl font-bold">Selecione uma conversa</h1>
                  <p className="mt-2 text-sm text-white/45">As mensagens chegam em tempo real pelo webhook; use sincronizar apenas para buscar histórico do telefone.</p>
                </div>
              </div>
            )}
          </main>
        </div>

        {newOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111b21] p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Nova conversa</h2>
                  <p className="text-sm text-white/45">Digite o número com DDD. O envio resolve automaticamente a variação com ou sem 9.</p>
                </div>
                <button type="button" onClick={() => setNewOpen(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-5 space-y-3">
                <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nome do cliente" className="h-11 w-full rounded-lg bg-[#0b141a] px-3 text-sm outline-none ring-1 ring-white/10 focus:ring-emerald-400/50" />
                <input value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="Telefone / WhatsApp" className="h-11 w-full rounded-lg bg-[#0b141a] px-3 text-sm outline-none ring-1 ring-white/10 focus:ring-emerald-400/50" />
                <button type="button" onClick={handleCreateConversation} className="h-11 w-full rounded-lg bg-emerald-500 font-black text-[#06140f] hover:bg-emerald-400">Criar conversa</button>
              </div>
            </div>
          </div>
        )}

        <WhatsappConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} onConnected={() => { loadConfigAndState(); setConnectOpen(false); }} />
      </div>
    </AdminShell>
  );
}

function Kpi({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-[#0b141a] px-2 py-2">
      <div className={cn("text-base font-black", accent ? "text-emerald-300" : "text-white")}>{value}</div>
      <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/35">{label}</div>
    </div>
  );
}

function Avatar({ conversation }: { conversation: Conversation }) {
  if (conversation.profile_pic_url) return <img src={conversation.profile_pic_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" loading="lazy" />;
  return <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-[#06140f]">{initials(conversation.contact_name, conversation.phone)}</div>;
}

function MessageBubble({ message }: { message: Message }) {
  const inbound = isInbound(message);
  const meta = statusMeta(message);
  const StatusIcon = meta.icon;
  return (
    <div className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div className={cn("group max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-md", inbound ? "rounded-tl-none bg-[#202c33] text-white" : "rounded-tr-none bg-[#005c4b] text-white", message.error && "ring-1 ring-red-400/50")} title={message.error ?? undefined}>
        {message.type !== "text" && <div className="mb-1 rounded bg-black/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white/55">{message.type}</div>}
        {message.media_url && <a href={message.media_url} target="_blank" rel="noreferrer" className="mb-2 block text-xs font-bold text-emerald-100 underline">Abrir mídia</a>}
        <div className="whitespace-pre-wrap break-words">{message.content || message.transcript || "Mensagem sem texto"}</div>
        {message.error && <div className="mt-2 whitespace-pre-wrap break-words rounded bg-red-950/70 p-2 text-xs text-red-100">{message.error}</div>}
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/55">
          <span>{formatTime(message.created_at)}</span>
          {!inbound && <StatusIcon className={cn("h-3.5 w-3.5", meta.className)} />}
        </div>
      </div>
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-lg px-2 py-3">
          <div className="h-11 w-11 rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 rounded bg-white/10" />
            <div className="h-3 w-3/4 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-16 w-2/3 rounded-lg bg-white/10" />
      <div className="ml-auto h-14 w-1/2 rounded-lg bg-emerald-500/20" />
      <div className="h-20 w-3/5 rounded-lg bg-white/10" />
      <div className="ml-auto h-12 w-2/5 rounded-lg bg-emerald-500/20" />
    </div>
  );
}

function EmptyChat() {
  return (
    <div className="mx-auto mt-20 max-w-sm text-center text-sm text-white/45">
      <MessageCircle className="mx-auto mb-3 h-10 w-10 text-white/25" />
      Nenhuma mensagem nesta conversa.
    </div>
  );
}