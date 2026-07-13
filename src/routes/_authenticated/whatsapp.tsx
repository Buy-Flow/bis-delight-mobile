import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageCircle,
  Search,
  Send,
  Bot,
  BotOff,
  CheckCheck,
  Check,
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
  Radio,
  Paperclip,
  Mic,
  Square,
  Play,
  Download,
  FileText,
  ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  sendWhatsappMessage,
  setAiPaused,
  markConversationRead,
  getWhatsappConfigStatus,
  getWhatsappConnectionState,
  syncWhatsappRecentMessages,
  updateWhatsappConversationPhone,
  configureWhatsappWebhook,
} from "@/lib/whatsapp.functions";
import {
  sendWhatsappMediaMessage,
  resolveWhatsappInboundMedia,
} from "@/lib/whatsapp-media.functions";
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
  _optimistic?: boolean;
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
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [config, setConfig] = useState<{
    configured: boolean;
    hasBase: boolean;
    hasKey: boolean;
    hasInstance: boolean;
  } | null>(null);
  const [connState, setConnState] = useState<{
    state: string;
    ownerJid?: string | null;
    profileName?: string | null;
    disconnectionAt?: string | null;
    disconnectionCode?: number | null;
  } | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [tab, setTab] = useState<"inbox" | "logs">("inbox");
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordStartRef = useRef<number>(0);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const sendFn = useServerFn(sendWhatsappMessage);
  const sendMediaFn = useServerFn(sendWhatsappMediaMessage);
  const pauseFn = useServerFn(setAiPaused);
  const readFn = useServerFn(markConversationRead);
  const cfgFn = useServerFn(getWhatsappConfigStatus);
  const stateFn = useServerFn(getWhatsappConnectionState);
  const syncFn = useServerFn(syncWhatsappRecentMessages);
  const updatePhoneFn = useServerFn(updateWhatsappConversationPhone);
  const configureWebhookFn = useServerFn(configureWhatsappWebhook);

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
    const loadState = () => stateFn().then(setConnState).catch(() => setConnState(null));
    loadState();
    const stateTimer = setInterval(loadState, 30_000);
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((item) => (item.id === m.id ? m : item)));
        },
      )
      .subscribe();

    const syncTimer = window.setInterval(() => syncFromPhone(false), 30000);

    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(syncTimer);
      clearInterval(stateTimer);
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

  useEffect(() => {
    setPhoneDraft(selected?.phone ?? "");
    setEditingPhone(false);
  }, [selected?.id, selected?.phone]);

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
      const res = await sendFn({ data: { conversation_id: selectedId, text: body } });
      // Replace optimistic with the persisted row from the server response
      const persisted = (res.message ?? null) as Message | null;
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (persisted && !withoutTemp.some((m) => m.id === persisted.id)) {
          return [...withoutTemp, persisted];
        }
        return withoutTemp;
      });
      if (persisted && (persisted.status === "failed" || persisted.status === "error")) {
        // eslint-disable-next-line no-console
        console.error("[whatsapp] envio falhou:\n" + (persisted.error ?? "(sem detalhes)"));
        toast.error("Falha ao enviar. Veja o balão para detalhes técnicos.");
      } else if (res.warning) {
        // eslint-disable-next-line no-console
        console.warn("[whatsapp] aviso:\n" + res.warning);
        toast.warning(res.warning);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar";
      // eslint-disable-next-line no-console
      console.error("[whatsapp] exceção ao enviar:", e);
      // Keep the optimistic bubble visible and mark as failed so the user
      // sees exactly which message failed and why (e.g. DB write error).
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "failed", error: msg } : m)),
      );
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const fileToBase64 = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(file);
    });

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedId) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo grande demais (máx. 16 MB pelo WhatsApp).");
      return;
    }
    const mime = file.type || "application/octet-stream";
    const kind: "image" | "video" | "audio" | "document" = mime.startsWith("image/")
      ? "image"
      : mime.startsWith("video/")
        ? "video"
        : mime.startsWith("audio/")
          ? "audio"
          : "document";
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await sendMediaFn({
        data: {
          conversation_id: selectedId,
          kind,
          base64: b64,
          mimetype: mime,
          filename: file.name,
          caption: text.trim() || undefined,
        },
      });
      setText("");
      const persisted = (res.message ?? null) as Message | null;
      if (persisted) {
        setMessages((prev) => (prev.some((m) => m.id === persisted.id) ? prev : [...prev, persisted]));
      }
      if (res.warning) toast.warning(res.warning);
      else toast.success("Mídia enviada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar mídia");
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      const mime = mimeCandidates.find((m) => (window.MediaRecorder as unknown as { isTypeSupported?: (m: string) => boolean }).isTypeSupported?.(m)) ?? "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recordChunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(recordChunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 512) {
          toast.error("Gravação muito curta.");
          return;
        }
        if (!selectedId) return;
        setUploading(true);
        try {
          const b64 = await fileToBase64(blob);
          const res = await sendMediaFn({
            data: {
              conversation_id: selectedId,
              kind: "audio",
              base64: b64,
              mimetype: blob.type || "audio/ogg",
              filename: `audio-${Date.now()}.ogg`,
            },
          });
          const persisted = (res.message ?? null) as Message | null;
          if (persisted) {
            setMessages((prev) => (prev.some((m) => m.id === persisted.id) ? prev : [...prev, persisted]));
          }
          if (res.warning) toast.warning(res.warning);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Erro ao enviar áudio");
        } finally {
          setUploading(false);
        }
      };
      mediaRecorderRef.current = rec;
      recordStartRef.current = Date.now();
      setRecordSeconds(0);
      rec.start();
      setRecording(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sem permissão de microfone");
    }
  };

  const stopRecording = (cancel = false) => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (cancel) {
      recordChunksRef.current = [];
      rec.onstop = () => {
        rec.stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
    }
    if (rec.state !== "inactive") rec.stop();
  };

  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => {
      setRecordSeconds(Math.floor((Date.now() - recordStartRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(t);
  }, [recording]);




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

  const handleSavePhone = async () => {
    if (!selected || phoneSaving) return;
    setPhoneSaving(true);
    try {
      const res = await updatePhoneFn({ data: { id: selected.id, phone: phoneDraft } });
      setConversations((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, phone: res.phone } : c)),
      );
      setPhoneDraft(res.phone);
      setEditingPhone(false);
      toast.success("Telefone corrigido para próximos envios.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao corrigir telefone");
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleReconfigureWebhook = async () => {
    setWebhookSaving(true);
    try {
      const res = await configureWebhookFn();
      toast.success("Webhook reconfigurado para o site publicado.");
      console.info("[whatsapp] webhook configurado:", res.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reconfigurar webhook");
    } finally {
      setWebhookSaving(false);
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
              onClick={handleReconfigureWebhook}
              disabled={webhookSaving}
              className="inline-flex items-center gap-2 rounded-full border border-sky-400/35 bg-sky-500/12 px-4 py-2 text-xs font-bold text-sky-100 transition hover:bg-sky-500/20 disabled:opacity-50"
            >
              {webhookSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
              Reconfigurar webhook
            </button>
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

        {/* Connection warning: instance was logged out from WhatsApp */}
        {connState &&
          config?.configured &&
          connState.state !== "open" &&
          connState.state !== "connecting" && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
              <div className="flex-1">
                <div className="font-bold text-red-100">
                  WhatsApp desconectado — nenhuma mensagem está sendo entregue
                </div>
                <div className="mt-1 text-xs leading-relaxed text-red-100/85">
                  A Evolution aceita os pedidos de envio (por isso as mensagens somem do painel
                  como "enviadas"), mas o WhatsApp derrubou a sessão do telefone
                  {connState.disconnectionCode === 401 ? " (logout 401 — o celular precisa parear de novo)" : ""}
                  {connState.disconnectionAt
                    ? ` em ${new Date(connState.disconnectionAt).toLocaleString("pt-BR")}`
                    : ""}
                  . Enquanto isso, só mensagens antigas (enviadas antes da queda) chegam ao destino.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setConnectOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-red-500/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500"
                  >
                    <Smartphone className="h-3.5 w-3.5" /> Reconectar telefone (QR code)
                  </button>
                  <button
                    onClick={() => stateFn().then(setConnState)}
                    className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-100 hover:bg-red-500/20"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Verificar de novo
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Connection healthy indicator */}
        {connState && connState.state === "open" && connState.profileName && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-100">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <div>
              WhatsApp conectado como{" "}
              <span className="font-bold">{connState.profileName}</span>
              {connState.ownerJid ? ` (${connState.ownerJid.split("@")[0]})` : ""}
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
                    {editingPhone ? (
                      <div className="mt-1 flex max-w-sm items-center gap-1.5">
                        <input
                          value={phoneDraft}
                          onChange={(e) => setPhoneDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSavePhone();
                            if (e.key === "Escape") setEditingPhone(false);
                          }}
                          placeholder="DDD + telefone"
                          className="h-7 min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-2.5 text-[11px] text-white outline-none focus:border-emerald-400"
                        />
                        <button
                          onClick={handleSavePhone}
                          disabled={phoneSaving}
                          className="rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black text-black disabled:opacity-50"
                        >
                          {phoneSaving ? "..." : "Salvar"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] text-white/50">
                        <Phone className="h-3 w-3" />
                        {formatPhone(selected.phone)}
                        <button
                          onClick={() => setEditingPhone(true)}
                          className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60 hover:bg-white/10 hover:text-white"
                        >
                          Corrigir
                        </button>
                      </div>
                    )}
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
                  {recording ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-red-400/40 bg-red-500/10 px-3 py-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      </span>
                      <span className="flex-1 text-sm font-bold text-red-100">
                        Gravando… {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:
                        {String(recordSeconds % 60).padStart(2, "0")}
                      </span>
                      <button
                        onClick={() => stopRecording(true)}
                        className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/30 text-white/80 hover:bg-black/50"
                        title="Cancelar"
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => stopRecording(false)}
                        className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-black hover:brightness-110"
                        title="Enviar áudio"
                        type="button"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-end gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*,audio/*,application/pdf"
                        onChange={handleFileSelected}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 disabled:opacity-40"
                        title="Anexar imagem, vídeo, áudio ou PDF"
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                      </button>
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
                      {text.trim() ? (
                        <button
                          onClick={handleSend}
                          disabled={sending}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-black transition hover:brightness-110 disabled:opacity-40"
                          title="Enviar"
                        >
                          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={startRecording}
                          disabled={uploading}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-black transition hover:brightness-110 disabled:opacity-40"
                          title="Gravar áudio"
                          type="button"
                        >
                          <Mic className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
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
  const meta = messageStatusMeta(m);
  const hasMedia = !!m.media_url || ["audio", "image", "video", "document", "sticker"].includes(m.type);
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start", "mb-1")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[75%]",
          out
            ? isAi
              ? "bg-gradient-to-br from-purple-500/30 to-fuchsia-500/20 border border-purple-400/30 text-white"
              : meta.kind === "failed"
                ? "bg-red-500/15 border border-red-500/40 text-white"
                : meta.kind === "sending"
                  ? "border border-amber-400/40 bg-amber-500/15 text-white"
                  : "bg-emerald-500/90 text-black"
            : "bg-white/10 text-white border border-white/10",
        )}
      >
        {isAi && (
          <div className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-purple-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
            <Sparkles className="h-2.5 w-2.5" /> IA
          </div>
        )}
        {hasMedia && <MediaPreview m={m} outbound={out && !isAi} />}
        {m.content && (
          <div className="whitespace-pre-wrap break-words">{m.content}</div>
        )}
        {!m.content && !hasMedia && m.transcript && (
          <div className="whitespace-pre-wrap break-words">🎤 {m.transcript}</div>
        )}
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            out && !isAi && meta.kind !== "failed" && meta.kind !== "sending" ? "text-black/60" : "text-white/60",
          )}
          title={out ? meta.label : undefined}
          aria-label={out ? `Status: ${meta.label}` : undefined}
        >
          <span>
            {new Date(m.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {out && (
            <span className={cn("inline-flex items-center gap-0.5", meta.className)}>
              {meta.icon}
              <span className="hidden sm:inline">{meta.label}</span>
            </span>
          )}
        </div>
        {meta.kind === "failed" && (m.error || m._optimistic) && (
          <FailedDetail error={m.error ?? "Não foi possível gravar a mensagem no banco de dados."} />
        )}

      </div>
    </div>
  );
}

/**
 * Renderiza mídia inline (áudio/imagem/vídeo/documento).
 * URLs do CDN criptografado do WhatsApp (mmg.whatsapp.net / .enc) precisam
 * ser baixadas pela Evolution primeiro — mostra botão "Carregar mídia".
 */
function MediaPreview({ m, outbound }: { m: Message; outbound: boolean }) {
  const resolveFn = useServerFn(resolveWhatsappInboundMedia);
  const [url, setUrl] = useState<string | null>(m.media_url ?? null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setUrl(m.media_url ?? null);
  }, [m.media_url]);

  const needsFetch =
    !url || /mmg\.whatsapp\.net|\.enc($|\?)/i.test(url) || (!url.startsWith("http") && !url.startsWith("data:"));

  const load = async () => {
    if (loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await resolveFn({ data: { message_id: m.id } });
      setUrl(res.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao baixar mídia");
    } finally {
      setLoading(false);
    }
  };

  const kind = m.type;

  if (needsFetch) {
    const label =
      kind === "audio" ? "áudio" : kind === "image" ? "imagem" : kind === "video" ? "vídeo" : "arquivo";
    return (
      <div className={cn("mb-1 flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs", outbound ? "border-black/15 bg-black/10 text-black/80" : "border-white/15 bg-black/20 text-white/80")}>
        {kind === "audio" ? <Mic className="h-3.5 w-3.5" /> : kind === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : kind === "video" ? <Play className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold transition", outbound ? "bg-black/20 hover:bg-black/30" : "bg-white/10 hover:bg-white/20")}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          {loading ? "Carregando…" : `Carregar ${label}`}
        </button>
        {err && <span className="text-[10px] text-red-300">{err}</span>}
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="mb-1">
        <audio controls preload="metadata" src={url!} className="w-full max-w-[260px]">
          Seu navegador não suporta áudio.
        </audio>
      </div>
    );
  }
  if (kind === "image" || kind === "sticker") {
    return (
      <a href={url!} target="_blank" rel="noreferrer" className="mb-1 block">
        <img
          src={url!}
          alt="mídia"
          className="max-h-72 w-auto max-w-full rounded-lg object-contain"
          loading="lazy"
        />
      </a>
    );
  }
  if (kind === "video") {
    return (
      <div className="mb-1">
        <video controls preload="metadata" src={url!} className="max-h-72 w-full max-w-[320px] rounded-lg" />
      </div>
    );
  }
  // documento ou fallback
  return (
    <a
      href={url!}
      target="_blank"
      rel="noreferrer"
      className={cn("mb-1 inline-flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs", outbound ? "border-black/15 bg-black/10 text-black/80" : "border-white/15 bg-black/20 text-white/80")}
    >
      <FileText className="h-3.5 w-3.5" />
      Abrir arquivo
    </a>
  );
}

function FailedDetail({ error }: { error: string }) {
  const [open, setOpen] = useState(false);
  const firstLine = error.split("\n")[0] ?? error;
  const hasMore = error.length > firstLine.length;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(error);
      toast.success("Detalhes copiados");
    } catch {
      toast.error("Não foi possível copiar");
    }
    // eslint-disable-next-line no-console
    console.error("[whatsapp] detalhes do envio falhado:\n" + error);
  };
  return (
    <div className="mt-1 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-1 text-[10px] text-red-200">
      <div className="whitespace-pre-wrap break-words">{firstLine}</div>
      {hasMore && (
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded border border-red-400/40 px-1.5 py-0.5 text-[10px] font-medium text-red-100 hover:bg-red-400/10"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {open ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded border border-red-400/40 px-1.5 py-0.5 text-[10px] font-medium text-red-100 hover:bg-red-400/10"
          >
            Copiar
          </button>
        </div>
      )}
      {open && hasMore && (
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-1.5 font-mono text-[10px] leading-tight text-red-100">
          {error}
        </pre>
      )}
    </div>
  );
}


type StatusMeta = {
  kind: "sending" | "sent" | "delivered" | "read" | "failed";
  label: string;
  icon: ReactNode;
  className: string;
};

function messageStatusMeta(m: Message): StatusMeta {
  const s = (m.status ?? "").toLowerCase();
  if (s === "sending" || m._optimistic) {
    return {
      kind: "sending",
      label: "Enviando",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      className: "text-white/70",
    };
  }
  if (s === "failed" || s === "error") {
    return {
      kind: "failed",
      label: "Falha",
      icon: <AlertTriangle className="h-3 w-3" />,
      className: "text-red-300",
    };
  }
  if (s === "pending") {
    return {
      kind: "sending",
      label: "Pendente",
      icon: <Clock className="h-3 w-3" />,
      className: "text-amber-300",
    };
  }
  if (s === "read" || m.read_at) {
    return {
      kind: "read",
      label: "Lida",
      icon: <CheckCheck className="h-3 w-3" />,
      className: "text-sky-400",
    };
  }
  if (s === "delivered" || s === "delivery_ack" || s === "server_ack") {
    return {
      kind: "delivered",
      label: "Entregue",
      icon: <CheckCheck className="h-3 w-3" />,
      className: "text-black/70",
    };
  }
  // default: sent
  return {
    kind: "sent",
    label: "Enviada",
    icon: <Check className="h-3 w-3" />,
    className: "text-black/70",
  };
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

type IngestLog = {
  id: string;
  created_at: string;
  source: string | null;
  event: string | null;
  status: "ok" | "skipped" | "error" | string;
  phone: string | null;
  evolution_id: string | null;
  from_me: boolean | null;
  message_type: string | null;
  preview: string | null;
  error: string | null;
  payload: unknown;
};

function LogsPanel() {
  const [logs, setLogs] = useState<IngestLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "skipped" | "error">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from("whatsapp_ingest_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, error } = await q;
    if (error) toast.error("Erro ao carregar logs: " + error.message);
    setLogs((data ?? []) as IngestLog[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("wa-ingest-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_ingest_logs" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const counts = useMemo(() => {
    const c = { ok: 0, skipped: 0, error: 0 };
    for (const l of logs) {
      if (l.status === "ok") c.ok += 1;
      else if (l.status === "skipped") c.skipped += 1;
      else if (l.status === "error") c.error += 1;
    }
    return c;
  }, [logs]);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white/80">
          <ScrollText className="h-4 w-4" /> Últimos 200 eventos
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
            Tudo · {logs.length}
          </Chip>
          <Chip active={statusFilter === "ok"} onClick={() => setStatusFilter("ok")}>
            <CheckCircle2 className="h-3 w-3 text-emerald-300" /> OK · {counts.ok}
          </Chip>
          <Chip active={statusFilter === "skipped"} onClick={() => setStatusFilter("skipped")}>
            <MinusCircle className="h-3 w-3 text-amber-300" /> Ignorados · {counts.skipped}
          </Chip>
          <Chip active={statusFilter === "error"} onClick={() => setStatusFilter("error")}>
            <XCircle className="h-3 w-3 text-red-300" /> Erros · {counts.error}
          </Chip>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Atualizar
          </button>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto">
        {logs.length === 0 && !loading && (
          <div className="p-8 text-center text-sm text-white/50">
            Nenhum log ainda. Assim que a Evolution API disparar eventos, tudo aparece aqui — inclusive o motivo de mensagens serem ignoradas.
          </div>
        )}
        {logs.map((l) => {
          const isOpen = expanded === l.id;
          const statusColor =
            l.status === "ok"
              ? "text-emerald-300"
              : l.status === "error"
                ? "text-red-300"
                : "text-amber-300";
          const StatusIcon =
            l.status === "ok" ? CheckCircle2 : l.status === "error" ? XCircle : MinusCircle;
          return (
            <div key={l.id} className="border-b border-white/5">
              <button
                onClick={() => setExpanded(isOpen ? null : l.id)}
                className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.04]"
              >
                <StatusIcon className={cn("mt-0.5 h-4 w-4 shrink-0", statusColor)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                    <span className="tabular-nums text-white/70">
                      {new Date(l.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    {l.event && (
                      <span className="rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono">
                        {l.event}
                      </span>
                    )}
                    {l.source && (
                      <span className="rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5">
                        {l.source}
                      </span>
                    )}
                    {l.phone && <span className="text-white/70">📱 {l.phone}</span>}
                    {l.from_me != null && (
                      <span className="text-white/40">{l.from_me ? "enviada" : "recebida"}</span>
                    )}
                    {l.message_type && <span className="text-white/40">{l.message_type}</span>}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-white">
                    {l.error ? (
                      <span className="text-red-200">{l.error}</span>
                    ) : (
                      <span className="text-white/80">{l.preview ?? "—"}</span>
                    )}
                  </div>
                </div>
                {isOpen ? (
                  <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-white/40" />
                ) : (
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/40" />
                )}
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-white/5 bg-black/40 px-4 py-3 text-[11px]">
                  {l.evolution_id && (
                    <div>
                      <span className="text-white/40">evolution_id:</span>{" "}
                      <span className="font-mono text-white/80">{l.evolution_id}</span>
                    </div>
                  )}
                  {l.error && (
                    <div>
                      <div className="mb-1 font-bold uppercase tracking-wider text-red-300">Erro</div>
                      <pre className="whitespace-pre-wrap break-words rounded-lg border border-red-500/30 bg-red-500/10 p-2 font-mono text-red-100">
                        {l.error}
                      </pre>
                    </div>
                  )}
                  <div>
                    <div className="mb-1 font-bold uppercase tracking-wider text-white/50">Payload</div>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/60 p-2 font-mono text-white/70">
                      {l.payload ? JSON.stringify(l.payload, null, 2) : "—"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
