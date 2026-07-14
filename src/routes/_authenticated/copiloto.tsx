import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  Send,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  ImageIcon,
  Ticket,
  BellRing,
  Timer,
  PauseCircle,
  Zap,
  MessageSquare,
  ListChecks,
  Undo2,
  X,
} from "lucide-react";
import { VoiceMicButton } from "@/components/VoiceMicButton";
import { getVoiceSettings, speakText } from "@/lib/voice-copilot.functions";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  listCopilotThreads,
  createCopilotThread,
  deleteCopilotThread,
  revertCopilotThread,
  getCopilotThreadMessages,
  listCopilotActions,
} from "@/lib/copilot.functions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const search = z.object({ t: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/copiloto")({
  validateSearch: search,
  component: CopilotoPage,
  head: () => ({
    meta: [
      { title: "Copiloto IA — Quero Bis" },
      { name: "description", content: "Assistente executor de campanhas, cupons e promoções" },
    ],
  }),
});

const SUGGESTIONS = [
  { icon: Zap, label: "Promoção relâmpago 20% off nos shakes hoje das 16h às 19h — banner + cupom SHAKE20" },
  { icon: BellRing, label: "Cria push pros fãs de açaí: 'Chegou o açaí de cupuaçu 🍫'" },
  { icon: Timer, label: "Banner de urgência 'Últimas horas: frete grátis!' até 22h" },
  { icon: PauseCircle, label: "Pausa o morango até 22h — 'Sem morango hoje'" },
];

function CopilotoPage() {
  const navigate = useNavigate();
  const params = useSearch({ from: "/_authenticated/copiloto" });
  const activeThreadId = params.t ?? null;
  const qc = useQueryClient();
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const threadsQ = useQuery({
    queryKey: ["copilot-threads"],
    queryFn: () => listCopilotThreads(),
    refetchOnWindowFocus: false,
  });

  const messagesQ = useQuery({
    queryKey: ["copilot-messages", activeThreadId],
    queryFn: () => (activeThreadId ? getCopilotThreadMessages({ data: { id: activeThreadId } }) : Promise.resolve([])),
    enabled: !!activeThreadId,
    refetchOnWindowFocus: false,
  });

  const actionsQ = useQuery({
    queryKey: ["copilot-actions", activeThreadId],
    queryFn: () => listCopilotActions({ data: { threadId: activeThreadId } }),
    refetchInterval: 5000,
  });

  const createMut = useMutation({
    mutationFn: (title?: string) => createCopilotThread({ data: { title } }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["copilot-threads"] });
      setThreadsOpen(false);
      navigate({ to: "/copiloto", search: { t: t.id } });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (v: { id: string; revertActions: boolean }) =>
      deleteCopilotThread({ data: v }),
    onSuccess: (res, v) => {
      qc.invalidateQueries({ queryKey: ["copilot-threads"] });
      qc.invalidateQueries({ queryKey: ["copilot-actions"] });
      const reverted = (res as { reverted?: number } | undefined)?.reverted ?? 0;
      toast.success(
        v.revertActions
          ? `Conversa apagada · ${reverted} alteração${reverted === 1 ? "" : "s"} revertida${reverted === 1 ? "" : "s"}`
          : "Conversa apagada",
      );
      setDeleteTarget(null);
      if (activeThreadId === v.id) navigate({ to: "/copiloto", search: {} });
    },
    onError: (e) => toast.error("Erro", { description: String(e).slice(0, 200) }),
  });

  const revertMut = useMutation({
    mutationFn: (id: string) => revertCopilotThread({ data: { id } }),
    onSuccess: (res) => {
      const n = (res as { reverted?: number } | undefined)?.reverted ?? 0;
      qc.invalidateQueries({ queryKey: ["copilot-actions"] });
      toast.success(`${n} alteração${n === 1 ? "" : "s"} revertida${n === 1 ? "" : "s"}`);
    },
    onError: (e) => toast.error("Erro ao reverter", { description: String(e).slice(0, 200) }),
  });

  const ThreadsList = (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={() => createMut.mutate(undefined)}
        disabled={createMut.isPending}
        className="mb-3 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-yellow to-amber-400 px-3 py-2.5 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> Nova conversa
      </button>
      <div className="flex-1 space-y-1 overflow-y-auto pr-1">
        {threadsQ.data?.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-white/40">Nenhuma conversa ainda</p>
        )}
        {threadsQ.data?.map((t) => {
          const active = t.id === activeThreadId;
          return (
            <div
              key={t.id}
              className={`group flex items-center gap-1 rounded-xl px-2 py-2 text-sm transition ${active ? "bg-neon-pink/25 ring-1 ring-neon-pink/40" : "hover:bg-white/5"}`}
            >
              <button
                type="button"
                onClick={() => {
                  setThreadsOpen(false);
                  navigate({ to: "/copiloto", search: { t: t.id } });
                }}
                className="flex-1 truncate text-left text-white/90"
              >
                {t.title}
              </button>
              <button
                type="button"
                aria-label="Excluir"
                onClick={() => setDeleteTarget({ id: t.id, title: t.title })}
                className="rounded-md p-1.5 text-white/50 transition hover:bg-red-500/20 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  const ActionsList = (
    <div className="flex h-full flex-col">
      {activeThreadId && (
        <button
          type="button"
          onClick={() => {
            if (confirm("Reverter todas as alterações desta conversa?\n\nIsto desativa cupons, popups, banners criados e restaura preços/pausas alteradas.")) {
              revertMut.mutate(activeThreadId);
            }
          }}
          disabled={revertMut.isPending || !actionsQ.data?.length}
          className="mb-3 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-40"
        >
          {revertMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
          Reverter alterações
        </button>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {actionsQ.data?.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-white/40">Sem ações ainda</p>
        )}
        {(actionsQ.data as ActionRow[] | undefined)?.map((a) => (
          <ActionCard key={a.id} action={a} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0518] via-[#120826] to-[#0b0518] text-white">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/10 bg-[#0b0518]/85 px-3 py-2 backdrop-blur md:hidden">
        <Sheet open={threadsOpen} onOpenChange={setThreadsOpen}>
          <SheetTrigger asChild>
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/90">
              <MessageSquare className="h-3.5 w-3.5" /> Conversas
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-sm border-purple-500/20 bg-[#0b0518] text-white sm:max-w-sm">
            <SheetHeader>
              <SheetTitle className="text-white">Conversas</SheetTitle>
            </SheetHeader>
            <div className="mt-4 h-[calc(100vh-6rem)]">{ThreadsList}</div>
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 items-center justify-center gap-1.5 truncate text-sm font-bold">
          <div className="grid h-6 w-6 flex-none place-items-center rounded-lg bg-gradient-to-br from-neon-yellow to-amber-400 text-black">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <span className="truncate">Copiloto</span>
        </div>

        <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
          <SheetTrigger asChild>
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/90">
              <ListChecks className="h-3.5 w-3.5" />
              {(actionsQ.data?.length ?? 0) > 0 && (
                <span className="rounded-full bg-neon-yellow px-1.5 py-0.5 text-[10px] font-bold text-black">
                  {actionsQ.data?.length}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] max-w-sm border-purple-500/20 bg-[#0b0518] text-white sm:max-w-sm">
            <SheetHeader>
              <SheetTitle className="text-white">Ações executadas</SheetTitle>
            </SheetHeader>
            <div className="mt-4 h-[calc(100vh-6rem)]">{ActionsList}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="mx-auto grid max-w-7xl gap-3 px-2 py-2 md:grid-cols-[240px_1fr_300px] md:gap-4 md:px-3 md:py-4">
        {/* Desktop sidebar */}
        <aside className="hidden rounded-2xl border border-purple-500/20 bg-black/30 p-3 md:block">
          {ThreadsList}
        </aside>

        <main className="min-h-[calc(100vh-8rem)] md:min-h-[75vh]">
          {activeThreadId ? (
            <ChatWindow
              threadId={activeThreadId}
              initialMessages={(messagesQ.data ?? []) as unknown as UIMessage[]}
              loading={messagesQ.isLoading}
              onActionMaybeExecuted={() => actionsQ.refetch()}
            />
          ) : (
            <EmptyState
              onSuggestion={async (text) => {
                const t = await createMut.mutateAsync(text.slice(0, 60));
                sessionStorage.setItem("copilot:pending", text);
                sessionStorage.setItem("copilot:pending-thread", t.id);
              }}
              onNew={() => createMut.mutate(undefined)}
            />
          )}
        </main>

        <aside className="hidden rounded-2xl border border-purple-500/20 bg-black/30 p-3 md:block">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/70">
            <Sparkles className="h-3.5 w-3.5 text-neon-yellow" /> Ações executadas
          </h3>
          {ActionsList}
        </aside>
      </div>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="border-purple-500/30 bg-[#120826] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Apagar conversa</DialogTitle>
            <DialogDescription className="text-white/60">
              "{deleteTarget?.title}"
              <br />
              O que você quer fazer com as alterações feitas por esta conversa?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={() =>
                deleteTarget && deleteMut.mutate({ id: deleteTarget.id, revertActions: false })
              }
              disabled={deleteMut.isPending}
              className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
            >
              <Trash2 className="mt-0.5 h-4 w-4 flex-none text-white/60" />
              <div>
                <p className="text-sm font-semibold">Apagar só a conversa</p>
                <p className="text-xs text-white/50">
                  Cupons, popups, banners e mudanças criadas continuam ativos.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() =>
                deleteTarget && deleteMut.mutate({ id: deleteTarget.id, revertActions: true })
              }
              disabled={deleteMut.isPending}
              className="flex w-full items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-left transition hover:bg-amber-400/20 disabled:opacity-50"
            >
              <Undo2 className="mt-0.5 h-4 w-4 flex-none text-amber-300" />
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  Apagar + reverter alterações
                </p>
                <p className="text-xs text-amber-200/70">
                  Desativa cupons/popups/banners criados, restaura preços e pausas.
                  Pushes enviados não podem ser desfeitos.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:bg-white/5"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ActionRow = {
  id: string;
  action_type: string;
  params: unknown;
  result: unknown;
  status: string;
  target_table: string | null;
  target_id: string | null;
  created_at: string;
  reverted_at?: string | null;
};

const ACTION_ICONS: Record<string, typeof ImageIcon> = {
  gerar_imagem_banner: ImageIcon,
  criar_popup: Sparkles,
  criar_cupom: Ticket,
  disparar_push: BellRing,
  pausar_produto: PauseCircle,
  despausar_produto: PauseCircle,
  banner_urgencia: Timer,
};

const ACTION_LABELS: Record<string, string> = {
  gerar_imagem_banner: "Banner gerado",
  criar_popup: "Popup criado",
  criar_cupom: "Cupom criado",
  disparar_push: "Push disparado",
  pausar_produto: "Produto pausado",
  despausar_produto: "Produto despausado",
  banner_urgencia: "Banner de urgência",
  buscar_produtos: "Produtos consultados",
  resumo_status: "Status da loja",
  atualizar_produto: "Produto atualizado",
  desconto_massa: "Desconto em massa",
  atualizar_config_loja: "Config. atualizada",
  forcar_status_loja: "Status forçado",
  atualizar_novidades_home: "Novidades atualizadas",
  criar_categoria: "Categoria criada",
};

function formatActionSummary(type: string, params: Record<string, unknown> | null): string[] {
  const p = params ?? {};
  const val = (k: string) => (p[k] === undefined || p[k] === null ? "" : String(p[k]));
  const fmtDate = (s: string) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  switch (type) {
    case "criar_cupom": {
      const code = val("code");
      const type_ = val("discount_type");
      const value = val("discount_value");
      const desc = type_ === "percent" ? `${value}% off` : type_ === "fixed" ? `R$ ${value} off` : value;
      return [
        code && `Código: ${code}`,
        desc && `Desconto: ${desc}`,
        val("max_uses") && `Limite: ${val("max_uses")} usos`,
        val("expires_at") && `Expira: ${fmtDate(val("expires_at"))}`,
      ].filter(Boolean) as string[];
    }
    case "criar_popup":
      return [
        val("title") && `Título: ${val("title")}`,
        val("cta") && `Botão: ${val("cta")}`,
        val("ends_at") && `Fim: ${fmtDate(val("ends_at"))}`,
      ].filter(Boolean) as string[];
    case "banner_urgencia":
      return [
        val("title") && `Msg: ${val("title")}`,
        val("ends_at") && `Até: ${fmtDate(val("ends_at"))}`,
      ].filter(Boolean) as string[];
    case "disparar_push":
      return [
        val("title") && `Título: ${val("title")}`,
        val("body") && `Msg: ${val("body")}`,
        val("audience_category") && `Categoria: ${val("audience_category")}`,
      ].filter(Boolean) as string[];
    case "gerar_imagem_banner":
      return [val("prompt") && `Prompt: ${val("prompt").slice(0, 120)}`].filter(Boolean) as string[];
    case "pausar_produto":
    case "despausar_produto":
      return [
        val("pause_reason") && `Motivo: ${val("pause_reason")}`,
        val("paused_until") && `Até: ${fmtDate(val("paused_until"))}`,
      ].filter(Boolean) as string[];
    default:
      return [];
  }
}

function ActionCard({ action }: { action: ActionRow }) {
  const Icon = ACTION_ICONS[action.action_type] ?? Sparkles;
  const time = new Date(action.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const result = action.result as Record<string, unknown> | null;
  const imgUrl =
    action.action_type === "gerar_imagem_banner" && result && typeof result.image_url === "string"
      ? (result.image_url as string)
      : null;
  const label = ACTION_LABELS[action.action_type] ?? action.action_type;
  const lines = formatActionSummary(action.action_type, action.params as Record<string, unknown> | null);
  const reverted = !!action.reverted_at;
  return (
    <div
      className={`rounded-xl border p-2 text-xs transition ${
        reverted
          ? "border-white/10 bg-black/20 opacity-50"
          : action.status === "failed"
            ? "border-red-500/40 bg-red-500/10"
            : "border-purple-500/25 bg-black/20"
      }`}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-neon-yellow" />
        <span className="font-semibold text-white/90">{label}</span>
        {reverted && (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-200">
            revertido
          </span>
        )}
        <span className="ml-auto text-[10px] text-white/40">{time}</span>
      </div>
      {imgUrl && (
        <img src={imgUrl} alt="banner" className="mb-1 h-24 w-full rounded-md object-cover" loading="lazy" />
      )}
      {lines.length > 0 && (
        <ul className="space-y-0.5 text-[11px] leading-tight text-white/70">
          {lines.map((l, i) => (
            <li key={i}>• {l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ onSuggestion, onNew }: { onSuggestion: (t: string) => void; onNew: () => void }) {
  return (
    <div className="rounded-2xl border border-purple-500/20 bg-black/30 p-6 text-center md:p-8">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-neon-yellow to-amber-500 text-black">
        <Bot className="h-8 w-8" />
      </div>
      <h2 className="mt-4 font-caveat text-4xl text-neon-yellow">Olá! Sou seu Copiloto</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-white/70">
        Me peça uma promoção, um banner, um cupom, uma pausa em produto ou um push — eu executo direto no site.
      </p>
      <div className="mx-auto mt-6 grid max-w-2xl gap-2 text-left sm:grid-cols-2">
        {SUGGESTIONS.map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSuggestion(label)}
            className="group flex items-start gap-2 rounded-xl border border-purple-500/30 bg-black/30 p-3 text-xs text-white/80 transition hover:border-neon-yellow/60 hover:bg-black/50 active:scale-[0.98]"
          >
            <Icon className="mt-0.5 h-4 w-4 flex-none text-neon-yellow transition group-hover:scale-110" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onNew}
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-neon-yellow/60 bg-neon-yellow/10 px-4 py-2 text-sm font-semibold text-neon-yellow transition hover:bg-neon-yellow/20"
      >
        <Plus className="h-4 w-4" /> Começar do zero
      </button>
    </div>
  );
}

function ChatWindow({
  threadId,
  initialMessages,
  loading,
  onActionMaybeExecuted,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  loading: boolean;
  onActionMaybeExecuted: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/copilot-chat",
        headers: () => ({ Authorization: token ? `Bearer ${token}` : "" }),
        body: () => ({ threadId }),
      }),
    [token, threadId],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: threadId,
    transport,
    messages: initialMessages,
    onError: (err) => {
      console.error(err);
      toast.error("Erro no Copiloto", { description: err.message.slice(0, 200) });
    },
    onFinish: () => onActionMaybeExecuted(),
  });

  useEffect(() => {
    if (initialMessages.length && messages.length === 0) setMessages(initialMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages.length]);

  useEffect(() => {
    if (!token) return;
    const pendingThread = sessionStorage.getItem("copilot:pending-thread");
    const pendingText = sessionStorage.getItem("copilot:pending");
    if (pendingThread === threadId && pendingText) {
      sessionStorage.removeItem("copilot:pending");
      sessionStorage.removeItem("copilot:pending-thread");
      sendMessage({ text: pendingText });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, status]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) textareaRef.current?.focus();
  }, [threadId, status]);

  const isLoading = status === "submitted" || status === "streaming";

  const submit = () => {
    const t = input.trim();
    if (!t || !token || isLoading) return;
    setInput("");
    sendMessage({ text: t });
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-purple-500/20 bg-black/30 md:h-[80vh]">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3 md:p-4">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Loader2 className="h-3 w-3 animate-spin" /> carregando histórico...
          </div>
        )}
        {messages.length === 0 && !loading && (
          <p className="pt-8 text-center text-sm text-white/40">
            Escreva sua primeira mensagem — ex: "cria promoção relâmpago 20% off nos shakes hoje das 16h às 19h"
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-neon-yellow">
            <Loader2 className="h-3 w-3 animate-spin" />
            {status === "submitted" ? "pensando..." : "trabalhando..."}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
            {error.message}
          </div>
        )}
      </div>

      <div className="border-t border-purple-500/20 bg-black/40 p-2 md:p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 768px)").matches) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Peça algo pro Copiloto..."
            className="flex-1 resize-none rounded-xl border border-purple-500/30 bg-black/60 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-neon-yellow/60 focus:outline-none md:text-sm"
          />
          <VoiceMicButton
            onTranscript={(t) => setInput((prev) => (prev ? prev + " " + t : t))}
            autoSubmit={(t) => { if (token && !isLoading) sendMessage({ text: t }); }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={!input.trim() || !token || isLoading}
            className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-neon-yellow to-amber-400 text-black transition hover:brightness-110 active:scale-95 disabled:opacity-40 md:h-11 md:w-11"
            aria-label="Enviar"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-1 hidden text-[10px] text-white/40 md:block">
          Enter para enviar · Shift+Enter para quebrar linha
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const parts = message.parts as Array<Record<string, unknown>>;

  const textContent = parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");

  const toolCalls = parts.filter((p) => typeof p.type === "string" && (p.type as string).startsWith("tool-"));

  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="grid h-7 w-7 flex-none place-items-center rounded-full bg-gradient-to-br from-neon-yellow to-amber-400 text-black">
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="max-w-[85%] space-y-2">
        {toolCalls.map((tc, i) => (
          <ToolCallChip key={i} part={tc} />
        ))}
        {textContent && (
          <div
            className={`rounded-2xl px-3 py-2 text-sm ${isUser ? "bg-neon-pink/20 text-white" : "bg-white/5 text-white/90"}`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{textContent}</p>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-strong:text-neon-yellow">
                <ReactMarkdown>{textContent}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCallChip({ part }: { part: Record<string, unknown> }) {
  const type = String(part.type ?? "");
  const toolName = type.replace(/^tool-/, "");
  const state = String(part.state ?? "");
  const Icon = ACTION_ICONS[toolName] ?? Sparkles;

  const label =
    {
      gerar_imagem_banner: "Gerando banner...",
      criar_popup: "Criando popup...",
      criar_cupom: "Criando cupom...",
      disparar_push: "Disparando push...",
      pausar_produto: "Pausando produto...",
      despausar_produto: "Despausando produto...",
      banner_urgencia: "Configurando urgência...",
      buscar_produtos: "Buscando produtos...",
      resumo_status: "Analisando loja...",
    }[toolName] ?? toolName;

  const done = state === "output-available";
  const failed = state === "output-error";

  const output = (part.output ?? (part as Record<string, unknown>).result) as
    | Record<string, unknown>
    | undefined;
  const imageUrl =
    done && toolName === "gerar_imagem_banner" && output && typeof output.image_url === "string"
      ? (output.image_url as string)
      : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
          failed
            ? "border-red-500/40 bg-red-500/10 text-red-200"
            : done
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow"
        }`}
      >
        {done ? (
          <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-400 text-black">✓</span>
        ) : failed ? (
          <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-red-400 text-black">!</span>
        ) : (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      {imageUrl && (
        <a
          href={imageUrl}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-xl border border-white/10 bg-black/40"
        >
          <img
            src={imageUrl}
            alt="Banner gerado"
            className="h-40 w-full max-w-sm object-cover md:h-48"
            loading="lazy"
          />
        </a>
      )}
    </div>
  );
}
