import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  getWaAiSettings,
  updateWaAiSettings,
  testWaAiReply,
  listWaAiLogs,
} from "@/lib/whatsapp-ai.functions";
import { Bot, Save, Send, Loader2, Info, AlertCircle, CheckCircle2, X, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/whatsapp-ia")({
  component: WhatsappAiAdmin,
  head: () => ({
    meta: [
      { title: "IA no WhatsApp — Quero Bis" },
      { name: "description", content: "Auto-resposta com IA que consulta estoque e preços reais no WhatsApp." },
    ],
  }),
});

type Settings = {
  id: string;
  enabled: boolean;
  model: string;
  system_prompt: string;
  greeting_message: string;
  fallback_message: string;
  out_of_hours_message: string;
  reply_delay_ms: number;
  max_replies_per_hour: number;
  business_hours_only: boolean;
  pause_after_human_min: number;
  handoff_keywords: string[];
  excluded_phones: string[];
  send_greeting: boolean;
  allow_stock: boolean;
  allow_price: boolean;
  allow_menu: boolean;
  allow_hours: boolean;
  allow_delivery: boolean;
  allow_promotions: boolean;
};

const MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash — rápido e barato (recomendado)" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite — mais barato" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro — mais inteligente" },
];

function WhatsappAiAdmin() {
  const _get = useServerFn(getWaAiSettings);
  const _upd = useServerFn(updateWaAiSettings);
  const _test = useServerFn(testWaAiReply);
  const _logs = useServerFn(listWaAiLogs);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["wa-ai-settings"], queryFn: () => _get({}) });
  const logsQ = useQuery({ queryKey: ["wa-ai-logs"], queryFn: () => _logs({}), refetchInterval: 15_000 });

  const [tab, setTab] = useState<"config" | "tools" | "behavior" | "playground" | "logs">("config");
  const [draft, setDraft] = useState<Settings | null>(null);
  useEffect(() => { if (data) setDraft(data as Settings); }, [data]);

  const mut = useMutation({
    mutationFn: (patch: Partial<Settings>) => _upd({ data: patch as any }),
    onSuccess: (row) => {
      qc.setQueryData(["wa-ai-settings"], row);
      setDraft(row as Settings);
      toast.success("Salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty = useMemo(() => {
    if (!data || !draft) return false;
    return JSON.stringify(data) !== JSON.stringify(draft);
  }, [data, draft]);

  const save = () => { if (draft) mut.mutate(draft); };
  const reset = () => { if (data) setDraft(data as Settings); };

  if (isLoading || !draft) {
    return <AdminShell><div className="p-8 flex items-center gap-2"><Loader2 className="animate-spin" /> Carregando…</div></AdminShell>;
  }

  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });

  return (
    <AdminShell>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Bot className="h-7 w-7 text-primary" /> IA no WhatsApp
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              A IA responde automaticamente às mensagens dos clientes, consultando estoque, preços e horários reais. Se não souber ou o cliente pedir humano, ela pausa e te avisa.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none px-4 py-2 rounded-full bg-muted hover:bg-muted/80">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => { set({ enabled: e.target.checked }); mut.mutate({ enabled: e.target.checked }); }}
              />
              <span className="text-sm font-medium">{draft.enabled ? "Ligada" : "Desligada"}</span>
              <span className={`h-2 w-2 rounded-full ${draft.enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            </label>
          </div>
        </div>

        {/* Status card */}
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${draft.enabled ? "bg-emerald-500/5 border-emerald-500/30" : "bg-amber-500/5 border-amber-500/30"}`}>
          {draft.enabled ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
          <div className="text-sm">
            {draft.enabled ? (
              <>IA ativa. Ela responde toda mensagem que chegar no WhatsApp{draft.business_hours_only ? " dentro do horário de funcionamento" : ""}. Palavras-chave de humano pausam automaticamente.</>
            ) : (
              <>IA desligada — nenhuma mensagem recebe resposta automática.</>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b overflow-x-auto">
          {(["config", "tools", "behavior", "playground", "logs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t === "config" && "Configuração"}
              {t === "tools" && "Capacidades"}
              {t === "behavior" && "Comportamento"}
              {t === "playground" && "Playground"}
              {t === "logs" && `Histórico${logsQ.data?.length ? ` (${logsQ.data.length})` : ""}`}
            </button>
          ))}
        </div>

        {tab === "config" && (
          <div className="space-y-6">
            <Section title="Modelo de IA" desc="Modelo que responde. Flash é o melhor custo-benefício.">
              <select
                value={draft.model}
                onChange={(e) => set({ model: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2"
              >
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Section>

            <Section title="Instruções da IA (prompt de sistema)" desc="Como ela deve conversar. Personalidade, tom, regras.">
              <textarea
                value={draft.system_prompt}
                onChange={(e) => set({ system_prompt: e.target.value })}
                rows={8}
                className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm"
              />
            </Section>

            <div className="grid md:grid-cols-2 gap-4">
              <Section title="Delay de resposta (ms)" desc="Simula digitação — evita parecer bot.">
                <input
                  type="number"
                  value={draft.reply_delay_ms}
                  onChange={(e) => set({ reply_delay_ms: parseInt(e.target.value || "0", 10) })}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                />
              </Section>
              <Section title="Limite/hora (global)" desc="Máximo de respostas por hora. 0 = ilimitado.">
                <input
                  type="number"
                  value={draft.max_replies_per_hour}
                  onChange={(e) => set({ max_replies_per_hour: parseInt(e.target.value || "0", 10) })}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                />
              </Section>
            </div>
          </div>
        )}

        {tab === "tools" && (
          <div className="space-y-3">
            <Info2>Cada ferramenta que você deixar ligada, a IA pode consultar antes de responder. Isso garante que ela nunca invente preço, estoque ou horário.</Info2>
            {[
              { key: "allow_stock" as const, label: "Consultar estoque", desc: "check_stock() — 'tem morango?' → busca em inventory_items" },
              { key: "allow_price" as const, label: "Consultar preços", desc: "find_product() — 'quanto custa?' → preço real do produto" },
              { key: "allow_menu" as const, label: "Listar cardápio", desc: "list_menu() — 'quais sabores?' → produtos por categoria" },
              { key: "allow_hours" as const, label: "Horário de funcionamento", desc: "store_hours() — informa se está aberto agora" },
              { key: "allow_delivery" as const, label: "Informações de entrega", desc: "delivery_info() — taxa, pedido mínimo, frete grátis" },
              { key: "allow_promotions" as const, label: "Cupons e promoções", desc: "active_promotions() — divulga cupons ativos" },
            ].map((t) => (
              <label key={t.key} className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={draft[t.key]}
                  onChange={(e) => set({ [t.key]: e.target.checked } as any)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{t.desc}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {tab === "behavior" && (
          <div className="space-y-6">
            <Section title="Saudação inicial" desc="Enviada na primeira mensagem de um contato novo.">
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={draft.send_greeting} onChange={(e) => set({ send_greeting: e.target.checked })} id="sg" />
                <label htmlFor="sg" className="text-sm">Enviar saudação em novos contatos</label>
              </div>
              <textarea rows={2} value={draft.greeting_message} onChange={(e) => set({ greeting_message: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
            </Section>

            <Section title="Mensagem de fallback" desc="Enviada quando a IA não consegue responder.">
              <textarea rows={2} value={draft.fallback_message} onChange={(e) => set({ fallback_message: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
            </Section>

            <Section title="Fora de horário" desc="Só responde no horário comercial.">
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={draft.business_hours_only} onChange={(e) => set({ business_hours_only: e.target.checked })} id="bh" />
                <label htmlFor="bh" className="text-sm">Responder somente em horário comercial</label>
              </div>
              <textarea rows={2} value={draft.out_of_hours_message} onChange={(e) => set({ out_of_hours_message: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
            </Section>

            <Section title="Pausa após atendimento humano (min)" desc="Se um atendente respondeu, a IA fica em silêncio por X minutos.">
              <input type="number" value={draft.pause_after_human_min} onChange={(e) => set({ pause_after_human_min: parseInt(e.target.value || "0", 10) })} className="w-full rounded-lg border bg-background px-3 py-2" />
            </Section>

            <Section title="Palavras-chave que pedem humano" desc="Se o cliente disser qualquer uma dessas, a IA não responde e marca handoff.">
              <TagList items={draft.handoff_keywords} onChange={(v) => set({ handoff_keywords: v })} placeholder="ex: humano" />
            </Section>

            <Section title="Números excluídos" desc="Contatos que nunca recebem resposta automática (apenas dígitos com DDI: 5511999...).">
              <TagList items={draft.excluded_phones} onChange={(v) => set({ excluded_phones: v })} placeholder="5511999999999" />
            </Section>
          </div>
        )}

        {tab === "playground" && <Playground testFn={_test} />}

        {tab === "logs" && (
          <div className="space-y-3">
            {logsQ.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin h-4 w-4" /> Carregando…</div>
            ) : !logsQ.data?.length ? (
              <div className="text-sm text-muted-foreground p-8 text-center border rounded-xl">Nenhum log ainda. Quando alguém mandar mensagem no WhatsApp, aparecerá aqui.</div>
            ) : (
              logsQ.data.map((l: any) => (
                <div key={l.id} className="p-4 rounded-xl border space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                    <div className="flex items-center gap-2">
                      {l.handoff && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs">handoff</span>}
                      {l.error && <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 text-xs">erro</span>}
                      {l.latency_ms && <span>{l.latency_ms}ms</span>}
                      <span className="font-mono">{l.phone}</span>
                    </div>
                  </div>
                  <div className="text-sm"><span className="font-semibold">Cliente:</span> {l.user_message}</div>
                  {l.ai_reply && <div className="text-sm text-emerald-700 dark:text-emerald-400"><span className="font-semibold">IA:</span> {l.ai_reply}</div>}
                  {l.error && <div className="text-xs text-red-600 font-mono">{l.error}</div>}
                  {Array.isArray(l.tools_used) && l.tools_used.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Ferramentas usadas ({l.tools_used.length})</summary>
                      <pre className="mt-2 p-2 rounded bg-muted overflow-auto text-[10px]">{JSON.stringify(l.tools_used, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Sticky save bar */}
        {dirty && tab !== "playground" && tab !== "logs" && (
          <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-background border shadow-lg rounded-full pl-4 pr-2 py-2 z-40">
            <span className="text-sm text-muted-foreground">Alterações não salvas</span>
            <button onClick={reset} className="px-3 py-1.5 rounded-full text-sm hover:bg-muted flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Desfazer</button>
            <button onClick={save} disabled={mut.isPending} className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm flex items-center gap-1 disabled:opacity-50">
              {mut.isPending ? <Loader2 className="animate-spin h-3 w-3" /> : <Save className="h-3 w-3" />}
              Salvar
            </button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <div className="font-medium">{title}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function Info2({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm p-3 rounded-xl bg-primary/5 border border-primary/20">
      <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function TagList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <button onClick={add} className="px-3 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1"><Plus className="h-3 w-3" /> Adicionar</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((k) => (
          <span key={k} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-sm">
            {k}
            <button onClick={() => onChange(items.filter((x) => x !== k))} className="hover:text-red-600"><X className="h-3 w-3" /></button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-muted-foreground">— nenhum —</span>}
      </div>
    </div>
  );
}

function Playground({ testFn }: { testFn: ReturnType<typeof useServerFn> }) {
  const [message, setMessage] = useState("Oi, tem morango hoje?");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r = await testFn({ data: { message } });
      setResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const samples = ["Tem morango?", "Quanto custa o açaí grande?", "Qual o cardápio hoje?", "Estão abertos?", "Quero falar com humano", "Tem promoção?"];

  return (
    <div className="space-y-4">
      <Info2>Teste como a IA responderia sem enviar nada pro cliente real. Ferramentas consultam os dados reais.</Info2>
      <div className="flex flex-wrap gap-2">
        {samples.map((s) => (
          <button key={s} onClick={() => setMessage(s)} className="px-3 py-1 rounded-full text-xs bg-muted hover:bg-muted/80">{s}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={message} onChange={(e) => setMessage(e.target.value)} className="flex-1 rounded-lg border bg-background px-3 py-2" placeholder="Mensagem do cliente…" />
        <button onClick={run} disabled={loading} className="px-4 rounded-lg bg-primary text-primary-foreground flex items-center gap-1 disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
          Testar
        </button>
      </div>
      {result && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/30">
            <div className="text-xs font-semibold text-emerald-600 mb-1">RESPOSTA DA IA {result.handoff && "(handoff)"} · {result.latency_ms}ms</div>
            <div className="text-sm whitespace-pre-wrap">{result.reply || "— (sem texto — apenas handoff)"}</div>
          </div>
          {result.tools_used?.length > 0 && (
            <div className="p-4 rounded-xl border">
              <div className="text-xs font-semibold mb-2">Ferramentas consultadas ({result.tools_used.length})</div>
              <pre className="text-[10px] overflow-auto bg-muted p-2 rounded">{JSON.stringify(result.tools_used, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
