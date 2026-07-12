import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, X, Send, Sparkles, Loader2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type PageInfo = { label: string; context: string; suggestions: string[] };

const PAGE_MAP: Record<string, PageInfo> = {
  "/admin": {
    label: "Dashboard",
    context: "Admin está no Dashboard geral. Pode pedir visão de vendas, produtos, ou comandar ações amplas.",
    suggestions: ["Resumo do dia", "Cria promoção relâmpago 15%"],
  },
  "/precificacao": {
    label: "Precificação",
    context: "Página de Precificação: define margem-alvo dos produtos e ajusta preços com base no CMV. Se o admin pedir margem X%, aplique atualização em massa nos produtos ativos recalculando preço = custo / (1 - margem).",
    suggestions: ["Muda margem-alvo pra 40% em todos", "Sugere preços com margem 45%"],
  },
  "/estoque": {
    label: "Estoque",
    context: "Página de Estoque: gerencia ingredientes, entradas, saídas, alertas de mínimo.",
    suggestions: ["Quais itens estão abaixo do mínimo?", "Adiciona 10kg de morango"],
  },
  "/ficha-tecnica": {
    label: "Ficha técnica",
    context: "Ficha técnica dos produtos: receitas, CMV, margem por item.",
    suggestions: ["Produtos com CMV acima de 40%", "Sugere onde cortar custo"],
  },
  "/lucratividade": {
    label: "Lucratividade",
    context: "Análise de lucratividade por produto, categoria e período.",
    suggestions: ["Top 5 mais lucrativos", "Produtos deficitários"],
  },
  "/financeiro": {
    label: "Financeiro",
    context: "Financeiro: receita, despesas, fluxo de caixa, comparativo.",
    suggestions: ["Receita da semana", "Compara com semana passada"],
  },
  "/clientes": {
    label: "Clientes",
    context: "Clientes: ranking VIP, LTV, RFM, aniversariantes.",
    suggestions: ["Top 10 VIPs", "Dispara push pros aniversariantes"],
  },
  "/avaliacoes": {
    label: "Avaliações",
    context: "Avaliações dos clientes: notas, tags negativas, sentimento.",
    suggestions: ["Média geral", "Reviews com nota baixa"],
  },
  "/rush": {
    label: "Cozinha",
    context: "Rush da cozinha: pedidos em tempo real, tempos, fila.",
    suggestions: ["Quantos pedidos abertos?", "Pausa o morango"],
  },
  "/entregas": {
    label: "Entregas",
    context: "Kanban de entregas ao vivo, motoboys, rotas.",
    suggestions: ["Pedidos em rota", "Tempo médio de entrega hoje"],
  },
  "/pdv": {
    label: "PDV",
    context: "Ponto de venda no balcão.",
    suggestions: ["Vendas do PDV hoje"],
  },
  "/caixa": {
    label: "Caixa",
    context: "Sessões de caixa: abertura, fechamento, sangrias, reforços.",
    suggestions: ["Caixa aberto agora", "Resumo da última sessão"],
  },
  "/mesas": {
    label: "Mesas",
    context: "Mesas e zonas do salão.",
    suggestions: ["Mesas ocupadas", "Cria zona 'Varanda'"],
  },
  "/garcons": {
    label: "Garçons",
    context: "Equipe de garçons e comissões.",
    suggestions: ["Top garçom da semana"],
  },
  "/impressao": {
    label: "Impressão",
    context: "Configurações e fila de impressão térmica.",
    suggestions: ["Jobs pendentes"],
  },
  "/biblioteca": {
    label: "Biblioteca de mídia",
    context: "Imagens do site — logos, banners, fotos de produto.",
    suggestions: ["Gera um banner de açaí"],
  },
  "/modelos": {
    label: "Modelos de produto",
    context: "Templates reutilizáveis de produto.",
    suggestions: ["Cria modelo de shake premium"],
  },
  "/importar": {
    label: "Importar cardápio",
    context: "Importa cardápio via foto/PDF com IA.",
    suggestions: ["Como funciona a importação?"],
  },
  "/carrinhos": {
    label: "Carrinhos abandonados",
    context: "Carrinhos abandonados dos clientes.",
    suggestions: ["Quantos abandonos hoje?", "Dispara push de recuperação"],
  },
  "/copiloto": {
    label: "Copiloto",
    context: "Página completa do Copiloto — ações executivas amplas.",
    suggestions: ["Cria campanha de fim de semana"],
  },
  "/ai-growth": {
    label: "AI Growth Engine",
    context: "Consultor de crescimento (leitura, sem edição).",
    suggestions: ["Ideias pra aumentar ticket médio"],
  },
  "/previsao": {
    label: "Previsão de demanda",
    context: "Heatmap e previsão de vendas por dia/hora.",
    suggestions: ["Horário de pico amanhã"],
  },
  "/usuarios": {
    label: "Usuários e permissões",
    context: "Equipe interna e papéis (admin, staff, kitchen, delivery).",
    suggestions: ["Quem tem acesso admin?"],
  },
  "/automacoes": {
    label: "Automações",
    context: "Automações e gatilhos push.",
    suggestions: ["Roda notificações agora"],
  },
};

function useCurrentPage(): PageInfo {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const tab = useRouterState({
    select: (r) => {
      const s = r.location.search as Record<string, unknown> | undefined;
      const v = s?.tab;
      return typeof v === "string" ? v : undefined;
    },
  });
  return useMemo(() => {
    if (pathname === "/admin" && tab) {
      const map: Record<string, PageInfo> = {
        products: { label: "Produtos", context: "Cardápio: gerenciar produtos, preços, ativar/pausar, badges, ordem.", suggestions: ["Aplica 10% off em todos", "Pausa o morango"] },
        categories: { label: "Categorias", context: "Categorias do cardápio.", suggestions: ["Cria categoria 'Especiais'"] },
        extras: { label: "Complementos", context: "Complementos/extras dos produtos.", suggestions: ["Lista todos os complementos"] },
        highlights: { label: "Destaques", context: "Produtos em destaque na home.", suggestions: ["Coloca shake como destaque"] },
        news: { label: "Novidades", context: "Ticker e banner de novidades da home.", suggestions: ["Muda ticker pra 'Frete grátis hoje'"] },
        promos: { label: "Promos & Combos", context: "Combos e promoções ativas.", suggestions: ["Cria combo Casal 2 shakes"] },
        coupons: { label: "Cupons", context: "Cupons de desconto.", suggestions: ["Cria SHAKE20 20% off"] },
        loyalty: { label: "Fidelidade", context: "Programa de fidelidade (Bronze/Prata/Ouro).", suggestions: ["Como estão os tiers?"] },
        notifications: { label: "Notificações", context: "Push notifications e campanhas.", suggestions: ["Cria push 'Chegou açaí novo'"] },
        announcement: { label: "Anúncio", context: "Anúncio no topo do site.", suggestions: ["Muda anúncio pra 'Aberto até 23h'"] },
        popup: { label: "Pop-up", context: "Pop-ups do site.", suggestions: ["Cria popup de 15% off"] },
        settings: { label: "Configurações da Loja", context: "Config: taxa entrega, mínimo, WhatsApp, cores.", suggestions: ["Muda taxa de entrega pra R$8"] },
      };
      if (map[tab]) return map[tab];
    }
    return PAGE_MAP[pathname] ?? {
      label: "Painel",
      context: `Admin está em ${pathname}.`,
      suggestions: ["O que dá pra fazer aqui?"],
    };
  }, [pathname, tab]);
}

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const page = useCurrentPage();
  const [input, setInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setToken(s?.access_token ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/copilot-chat",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: { pageContext: `${page.label}: ${page.context}` },
      }),
    [token, page.label, page.context],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "floating-assistant",
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, isLoading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const submit = () => {
    const t = input.trim();
    if (!t || isLoading) return;
    setInput("");
    sendMessage({ text: t });
  };

  return (
    <>
      {/* Trigger button — fixed bottom-right */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-full border border-white/10 bg-gradient-to-br from-neon-pink to-purple-600 px-4 py-3 text-white shadow-2xl shadow-neon-pink/40 hover:scale-105 transition"
          aria-label="Abrir assistente virtual"
        >
          <div className="relative">
            <Bot className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-neon-yellow animate-pulse" />
          </div>
          <span className="hidden sm:inline text-xs font-bold uppercase tracking-wide">
            IA · {page.label}
          </span>
        </button>
      )}

      {/* Chat popup */}
      {open && (
        <div className="fixed bottom-4 right-4 z-[60] flex h-[min(560px,calc(100vh-2rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#170a2e] shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-white/10 bg-gradient-to-r from-neon-pink/20 to-purple-600/20 px-3 py-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-neon-pink to-purple-600">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-widest text-neon-yellow">
                Assistente · {page.label}
              </div>
              <div className="text-[11px] text-white/60 truncate">
                Foco na página atual
              </div>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
                title="Nova conversa"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Minimizar"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setMessages([]);
              }}
              className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 leading-relaxed">
                  Oi! Sou seu assistente com foco em <span className="font-bold text-neon-yellow">{page.label}</span>. Peça alterações direto e eu executo.
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                    Sugestões
                  </div>
                  {page.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setInput("");
                        sendMessage({ text: s });
                      }}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/80 hover:border-neon-pink/50 hover:bg-neon-pink/10 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => {
              const text = m.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              const toolCalls = m.parts.filter((p) => p.type?.startsWith("tool-"));
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                      m.role === "user"
                        ? "bg-gradient-to-br from-neon-pink to-purple-600 text-white"
                        : "bg-white/5 text-white/90 border border-white/10",
                    )}
                  >
                    {toolCalls.length > 0 && m.role === "assistant" && (
                      <div className="mb-1.5 flex flex-wrap gap-1">
                        {toolCalls.map((tc, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-neon-yellow/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neon-yellow"
                          >
                            <Sparkles className="h-2.5 w-2.5" />
                            {tc.type.replace("tool-", "")}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.role === "assistant" ? (
                      <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-p:text-xs prose-img:my-1 prose-img:rounded-lg">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{text}</div>
                    )}
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Pensando…</span>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-white/10 bg-black/20 p-2">
            <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 focus-within:border-neon-pink/50">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder={`Peça algo em ${page.label}…`}
                className="flex-1 resize-none bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none max-h-32 py-1"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={submit}
                disabled={!input.trim() || isLoading}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-neon-pink to-purple-600 text-white disabled:opacity-40"
                aria-label="Enviar"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
