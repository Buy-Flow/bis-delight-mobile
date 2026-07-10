import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  BellRing,
  Send,
  Users,
  Cake,
  Moon,
  Globe,
  ImageIcon,
  Trash2,
  Pencil,
  Clock,
  Infinity as InfinityIcon,
  X,
  Check,
  CalendarClock,
  Zap,
  Sparkles,
  Gift,
  UserPlus,
  Power,
  Plus,
  Wand2,
  Rocket,
  Filter,
  MessageSquare,
  ChevronDown,
  Link2,
  Package,
  Search,
  CreditCard,
  Star,
  Trophy,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types

type Audience = "all" | "recent_30d" | "birthday_month" | "dormant_60d";
type AutoKind = "birthday" | "dormant" | "welcome" | "after_order" | "abandoned_cart";

interface Campaign {
  id: string;
  title: string;
  body: string;
  url: string | null;
  image: string | null;
  audience: string;
  sent_count: number;
  opened_count: number;
  failed_count: number;
  created_at: string;
  expires_at: string | null;
  status?: string | null;
  scheduled_for?: string | null;
}

interface Automation {
  id: string;
  kind: AutoKind;
  name: string | null;
  title: string;
  body: string;
  url: string | null;
  image: string | null;
  active: boolean;
  config: Record<string, any>;
  filters: Record<string, any>;
  last_run_at: string | null;
  created_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants

const audiences: { value: Audience; label: string; icon: typeof Users; hint: string }[] = [
  { value: "all", label: "Todos os inscritos", icon: Globe, hint: "Quem ativou notificações" },
  { value: "recent_30d", label: "Compraram nos últimos 30 dias", icon: Users, hint: "Clientes ativos" },
  { value: "birthday_month", label: "Aniversariantes do mês", icon: Cake, hint: "Com data cadastrada" },
  { value: "dormant_60d", label: "Sem compra há 60+ dias", icon: Moon, hint: "Traga de volta" },
];

const durationOptions: { value: number | null; label: string }[] = [
  { value: 10, label: "10 min" },
  { value: 60, label: "1 h" },
  { value: 60 * 6, label: "6 h" },
  { value: 60 * 24, label: "24 h" },
  { value: 60 * 24 * 3, label: "3 dias" },
  { value: 60 * 24 * 7, label: "7 dias" },
  { value: null, label: "Nunca" },
];

const AUTO_META: Record<AutoKind, { label: string; hint: string; icon: typeof Gift; accent: string; ring: string }> = {
  birthday: {
    label: "Aniversário",
    hint: "Dispara no dia (ou X dias antes/depois), na hora que você escolher.",
    icon: Cake,
    accent: "text-neon-yellow",
    ring: "ring-neon-yellow/40",
  },
  welcome: {
    label: "Boas-vindas",
    hint: "Depois do 1º pedido, com atraso configurável.",
    icon: UserPlus,
    accent: "text-neon-pink",
    ring: "ring-neon-pink/40",
  },
  after_order: {
    label: "Após pedido",
    hint: "Depois de cada pedido (ou só no 1º), com atraso em minutos/horas.",
    icon: Sparkles,
    accent: "text-neon-cyan",
    ring: "ring-neon-cyan/40",
  },
  dormant: {
    label: "Cliente inativo",
    hint: "Quem não pede há X dias. Empilhe em degraus (7, 30, 60…).",
    icon: Moon,
    accent: "text-neon-cyan",
    ring: "ring-neon-cyan/40",
  },
  abandoned_cart: {
    label: "Carrinho abandonado",
    hint: "X minutos depois do cliente parar sem finalizar.",
    icon: Zap,
    accent: "text-neon-pink",
    ring: "ring-neon-pink/40",
  },
};

const KIND_OPTIONS: AutoKind[] = ["birthday", "welcome", "after_order", "dormant", "abandoned_cart"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

function fmtRemaining(iso: string | null): { label: string; expired: boolean } {
  if (!iso) return { label: "Sem expiração", expired: false };
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return { label: "Expirada", expired: true };
  const m = Math.floor(diff / 60000);
  if (m < 60) return { label: `expira em ${m} min`, expired: false };
  const h = Math.floor(m / 60);
  if (h < 24) return { label: `expira em ${h}h`, expired: false };
  const d = Math.floor(h / 24);
  return { label: `expira em ${d}d`, expired: false };
}

function summarizeConfig(kind: AutoKind, cfg: any, filters: any): string {
  const parts: string[] = [];
  if (kind === "birthday") {
    const off = Number(cfg?.days_offset ?? 0);
    parts.push(off === 0 ? "no dia" : off > 0 ? `${off}d depois` : `${Math.abs(off)}d antes`);
    parts.push(`às ${String(cfg?.hour ?? 9).padStart(2, "0")}h`);
  } else if (kind === "welcome" || kind === "after_order") {
    const m = Number(cfg?.delay_minutes ?? 0);
    parts.push(m >= 60 ? `${Math.round(m / 60)}h depois` : `${m} min depois`);
    if (kind === "after_order" && cfg?.only_first) parts.push("(só 1º)");
  } else if (kind === "dormant") {
    parts.push(`${cfg?.days ?? 30} dias sem pedir`);
    if (cfg?.repeat_weekly) parts.push("semanal");
  } else if (kind === "abandoned_cart") {
    parts.push(`${Number(cfg?.delay_minutes ?? 15)} min após abandono`);
  }
  const f: string[] = [];
  if (filters?.min_orders) f.push(`≥${filters.min_orders} pedidos`);
  if (filters?.max_orders) f.push(`≤${filters.max_orders} pedidos`);
  if (filters?.min_spent_total) f.push(`gastou R$${filters.min_spent_total}+`);
  if (filters?.ordered_within_days) f.push(`comprou ≤${filters.ordered_within_days}d`);
  if (filters?.not_ordered_within_days) f.push(`sem compra ≥${filters.not_ordered_within_days}d`);
  return [parts.join(" · "), f.length ? `filtro: ${f.join(", ")}` : ""].filter(Boolean).join(" — ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Root

export function NotificationsTab() {
  const [tab, setTab] = useState<"compose" | "history" | "automations">("compose");
  const [totalSubs, setTotalSubs] = useState<number | null>(null);
  const [history, setHistory] = useState<Campaign[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [{ count }, { data: campaigns }, { data: autos }] = await Promise.all([
      supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
      supabase.rpc("admin_list_push_campaigns", { _limit: 40 }),
      supabase.from("push_automations").select("*").order("created_at", { ascending: false }),
    ]);
    setTotalSubs(count ?? 0);
    setHistory((campaigns ?? []) as Campaign[]);
    setAutomations((autos ?? []) as Automation[]);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const stats = useMemo(() => {
    const sent = history.reduce((acc, c) => acc + (c.sent_count ?? 0), 0);
    const opened = history.reduce((acc, c) => acc + (c.opened_count ?? 0), 0);
    const scheduled = history.filter((c) => c.status === "scheduled" && c.scheduled_for).length;
    const activeAutos = automations.filter((a) => a.active).length;
    return { sent, opened, scheduled, activeAutos };
  }, [history, automations]);

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neon-pink/25 via-purple-950/60 to-neon-cyan/15 p-6 shadow-[0_20px_60px_-20px_rgba(236,72,153,0.4)]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-neon-pink/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-neon-cyan/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neon-yellow">
              <BellRing className="h-3 w-3" /> Central de notificações
            </div>
            <h2 className="font-display text-3xl font-black leading-tight text-white sm:text-4xl">
              Fala com quem <span className="text-neon-yellow">importa</span>.
            </h2>
            <p className="mt-1 max-w-md text-sm text-white/70">
              Envie push, agende para o futuro ou monte automações do seu jeito — quantos gatilhos quiser.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <StatPill label="Ativos" value={totalSubs ?? "—"} icon={Users} tone="cyan" />
            <StatPill label="Enviadas" value={stats.sent} icon={Send} tone="pink" />
            <StatPill label="Agendadas" value={stats.scheduled} icon={CalendarClock} tone="yellow" />
            <StatPill label="Automações" value={stats.activeAutos} icon={Zap} tone="pink" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
        <TabButton active={tab === "compose"} onClick={() => setTab("compose")} icon={Rocket} label="Enviar agora" />
        <TabButton active={tab === "automations"} onClick={() => setTab("automations")} icon={Wand2} label={`Automações (${automations.length})`} />
        <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={Clock} label={`Histórico (${history.length})`} />
      </div>

      {loading ? (
        <div className="grid place-items-center py-12 text-white/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === "compose" ? (
        <ComposeSection totalSubs={totalSubs} onSent={refresh} />
      ) : tab === "automations" ? (
        <AutomationsPanel items={automations} onChanged={refresh} />
      ) : (
        <HistorySection history={history} onChanged={refresh} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header bits

function StatPill({
  label, value, icon: Icon, tone,
}: { label: string; value: number | string; icon: typeof Users; tone: "cyan" | "pink" | "yellow" }) {
  const toneCls =
    tone === "cyan" ? "text-neon-cyan" : tone === "pink" ? "text-neon-pink" : "text-neon-yellow";
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur">
      <div className={`flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider ${toneCls}`}>
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 text-xl font-black text-white">{value}</div>
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: typeof Users; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
        active
          ? "bg-gradient-to-br from-neon-pink to-purple-700 text-white shadow-lg shadow-neon-pink/30"
          : "text-white/60 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compose

function ComposeSection({ totalSubs, onSent }: { totalSubs: number | null; onSent: () => Promise<void> | void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [durationMin, setDurationMin] = useState<number | null>(60 * 24);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [sending, setSending] = useState(false);

  const preview = useMemo(
    () => ({
      title: title.trim() || "Título da notificação",
      body: body.trim() || "Sua mensagem aparecerá aqui.",
    }),
    [title, body],
  );

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      toast.error("Preencha título e mensagem.");
      return;
    }
    const scheduledIso = scheduledAt ? new Date(scheduledAt).toISOString() : null;
    if (scheduledIso && new Date(scheduledIso).getTime() < Date.now() - 60_000) {
      toast.error("Escolha uma data/hora no futuro.");
      return;
    }
    setSending(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const expiresAt =
        durationMin !== null ? new Date(Date.now() + durationMin * 60_000).toISOString() : null;
      const { data: campaign, error } = await supabase
        .from("push_campaigns")
        .insert({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || null,
          image: image.trim() || null,
          audience,
          expires_at: expiresAt,
          created_by: user.user?.id ?? null,
          status: scheduledIso ? "scheduled" : "sent",
          scheduled_for: scheduledIso,
        } as any)
        .select()
        .single();
      if (error || !campaign) throw error;

      if (scheduledIso) {
        toast.success(`Agendada para ${new Date(scheduledIso).toLocaleString("pt-BR")}`);
      } else {
        const { data: session } = await supabase.auth.getSession();
        const projectUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
        const res = await fetch(`${projectUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            apikey: anon,
            Authorization: `Bearer ${session.session?.access_token ?? anon}`,
          },
          body: JSON.stringify({ campaignId: campaign.id }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error || "Falha no envio");
        toast.success(
          `Enviado! ${result.sent} entregues${result.failed ? `, ${result.failed} falharam` : ""}.`,
        );
      }
      setTitle("");
      setBody("");
      setUrl("");
      setImage("");
      setScheduledAt("");
      await onSent();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-5 rounded-3xl border border-white/10 bg-gradient-to-b from-purple-950/40 to-black/40 p-6 shadow-inner">
        <FieldGroup icon={MessageSquare} label="Conteúdo" tone="pink">
          <Field label="Título" hint={`${title.length}/60`}>
            <input
              type="text"
              maxLength={60}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: 🍧 Sabor novo chegou!"
              className={inputCls}
            />
          </Field>
          <Field label="Mensagem" hint={`${body.length}/180`}>
            <textarea
              rows={3}
              maxLength={180}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="A mensagem que aparece no push..."
              className={`${inputCls} resize-none`}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Personalizar:</span>
              {[
                { tok: "{{primeiro_nome}}", label: "primeiro nome" },
                { tok: "{{nome}}", label: "nome completo" },
              ].map((v) => (
                <button
                  key={v.tok}
                  type="button"
                  onClick={() => setBody((b) => (b + " " + v.tok).trim())}
                  className="rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2 py-0.5 text-[10px] font-bold text-neon-cyan hover:bg-neon-cyan/20"
                >
                  + {v.label}
                </button>
              ))}
            </div>
          </Field>
          <LinkPicker value={url} onChange={setUrl} />
          <Field label={<><ImageIcon className="mr-1 inline h-3 w-3" /> Imagem (opcional)</>}>
            <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." className={inputCls} />
          </Field>

        </FieldGroup>

        <FieldGroup icon={Users} label="Público" tone="cyan">
          <div className="grid gap-2 sm:grid-cols-2">
            {audiences.map((a) => {
              const Icon = a.icon;
              const active = audience === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAudience(a.value)}
                  className={`rounded-2xl border p-3 text-left text-sm transition ${
                    active
                      ? "border-neon-cyan bg-neon-cyan/10 text-white shadow-lg shadow-neon-cyan/10"
                      : "border-white/10 bg-black/20 text-white/70 hover:border-white/30"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    <Icon className="h-4 w-4" /> {a.label}
                  </div>
                  <p className="mt-1 text-[11px] text-white/50">{a.hint}</p>
                </button>
              );
            })}
          </div>
        </FieldGroup>

        <FieldGroup icon={Clock} label="Duração e agendamento" tone="yellow">
          <Field label="Tempo visível no sino do cliente">
            <div className="flex flex-wrap gap-2">
              {durationOptions.map((d) => {
                const active = durationMin === d.value;
                return (
                  <button
                    key={String(d.value)}
                    type="button"
                    onClick={() => setDurationMin(d.value)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "border-neon-yellow bg-neon-yellow/15 text-neon-yellow"
                        : "border-white/10 bg-black/20 text-white/70 hover:border-white/30"
                    }`}
                  >
                    {d.value === null ? <InfinityIcon className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {d.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={<><CalendarClock className="mr-1 inline h-3 w-3" /> Agendar envio (opcional)</>}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className={`${inputCls} [color-scheme:dark] w-auto`}
              />
              {scheduledAt && (
                <button type="button" onClick={() => setScheduledAt("")} className="text-[11px] text-white/50 underline hover:text-white">
                  limpar
                </button>
              )}
              <span className="text-[10px] text-white/40">
                {scheduledAt
                  ? `Dispara em ${new Date(scheduledAt).toLocaleString("pt-BR")}`
                  : "Vazio = enviar agora."}
              </span>
            </div>
          </Field>
        </FieldGroup>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs text-white/70">
            {totalSubs !== null ? (
              <>
                <span className="text-lg font-black text-white">{totalSubs}</span>
                <span className="ml-1">dispositivos vão receber.</span>
              </>
            ) : (
              "Carregando..."
            )}
          </p>
          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon-pink to-purple-600 px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-neon-pink/30 transition hover:brightness-110 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : scheduledAt ? (
              <CalendarClock className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending ? "Enviando..." : scheduledAt ? "Agendar" : "Enviar agora"}
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="sticky top-4 space-y-4">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-black/60 to-purple-950/40 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
              Prévia
            </p>
            <div className="flex gap-3 rounded-2xl bg-white/95 p-3 text-black shadow-2xl">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2a1240] to-[#4a1a5a]">
                <BellRing className="h-5 w-5 text-neon-yellow" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase text-black/50">Quero Bis · agora</div>
                <div className="truncate font-black">{preview.title}</div>
                <div className="line-clamp-2 text-xs text-black/70">{preview.body}</div>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-white/40">
              Assim aparece na tela de bloqueio do celular do cliente.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History (with scheduled + edit + delete)

function HistorySection({ history, onChanged }: { history: Campaign[]; onChanged: () => Promise<void> | void }) {
  const [editing, setEditing] = useState<Campaign | null>(null);
  const scheduled = history.filter((c) => c.status === "scheduled" && c.scheduled_for);
  const sent = history.filter((c) => !(c.status === "scheduled" && c.scheduled_for));

  async function handleDelete(c: Campaign) {
    if (!confirm(`Apagar "${c.title}"?`)) return;
    const { error } = await supabase.from("push_campaigns").delete().eq("id", c.id);
    if (error) return toast.error("Erro ao apagar");
    toast.success("Apagada");
    await onChanged();
  }
  async function handleExpireNow(c: Campaign) {
    const { error } = await supabase
      .from("push_campaigns")
      .update({ expires_at: new Date().toISOString() } as any)
      .eq("id", c.id);
    if (error) return toast.error("Erro ao expirar");
    toast.success("Expirada agora");
    await onChanged();
  }
  async function cancelScheduled(c: Campaign) {
    if (!confirm(`Cancelar o envio agendado de "${c.title}"?`)) return;
    const { error } = await supabase
      .from("push_campaigns")
      .update({ status: "canceled" } as any)
      .eq("id", c.id);
    if (error) return toast.error("Erro ao cancelar");
    toast.success("Cancelado");
    await onChanged();
  }

  return (
    <div className="space-y-6">
      {scheduled.length > 0 && (
        <section className="rounded-3xl border border-neon-cyan/30 bg-neon-cyan/[0.06] p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-neon-cyan" />
            <h3 className="font-display text-lg font-black">Agendadas</h3>
            <span className="rounded-full bg-neon-cyan/20 px-2 py-0.5 text-[10px] font-black text-neon-cyan">
              {scheduled.length}
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {scheduled.map((c) => (
              <li key={c.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-white">{c.title}</div>
                  <div className="line-clamp-2 text-[11px] text-white/60">{c.body}</div>
                  <div className="mt-1 text-[10px] font-bold text-neon-cyan">
                    🗓️ {new Date(c.scheduled_for!).toLocaleString("pt-BR")}
                  </div>
                </div>
                <button
                  onClick={() => cancelScheduled(c)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-red-400 hover:bg-white/10"
                  title="Cancelar envio"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-3xl border border-white/10 bg-black/30 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-white/70" />
          <h3 className="font-display text-lg font-black">Enviadas</h3>
        </div>
        {sent.length === 0 ? (
          <p className="py-6 text-center text-xs text-white/40">Nenhuma campanha enviada ainda.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {sent.map((c) => {
              const rem = fmtRemaining(c.expires_at);
              const opens = c.sent_count > 0 ? Math.round((c.opened_count / c.sent_count) * 100) : 0;
              return (
                <li
                  key={c.id}
                  className={`rounded-2xl border p-3 transition ${
                    rem.expired
                      ? "border-white/5 bg-black/20 opacity-60"
                      : "border-white/10 bg-gradient-to-br from-black/40 to-purple-950/20 hover:border-neon-pink/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-white">{c.title}</div>
                      <div className="line-clamp-2 text-[11px] text-white/60">{c.body}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <IconBtn onClick={() => setEditing(c)} title="Editar" tone="cyan"><Pencil className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn onClick={() => handleDelete(c)} title="Apagar" tone="red"><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-white/50">
                    <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-neon-cyan/15 px-2 py-0.5 font-bold text-neon-cyan">
                        {c.sent_count} enviadas
                      </span>
                      <span className="rounded-full bg-neon-pink/15 px-2 py-0.5 font-bold text-neon-pink">
                        {opens}% abriram
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                          rem.expired ? "bg-white/5 text-white/40" : c.expires_at ? "bg-neon-yellow/15 text-neon-yellow" : "bg-white/5 text-white/50"
                        }`}
                      >
                        {c.expires_at ? <Clock className="h-2.5 w-2.5" /> : <InfinityIcon className="h-2.5 w-2.5" />}
                        {rem.label}
                      </span>
                      {!rem.expired && c.expires_at && (
                        <button
                          onClick={() => handleExpireNow(c)}
                          className="rounded-full bg-white/5 px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
                        >
                          expirar
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editing && (
        <EditCampaignModal
          campaign={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await onChanged(); }}
        />
      )}
    </div>
  );
}

function IconBtn({
  onClick, title, children, tone,
}: { onClick: () => void; title: string; children: React.ReactNode; tone: "cyan" | "red" }) {
  const t = tone === "cyan" ? "text-neon-cyan" : "text-red-400";
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`grid h-7 w-7 place-items-center rounded-full hover:bg-white/10 ${t}`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Automations — flat list, blank-canvas creator

function AutomationsPanel({ items, onChanged }: { items: Automation[]; onChanged: () => Promise<void> | void }) {
  const [creating, setCreating] = useState<AutoKind | null>(null);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);

  const toggleActive = async (a: Automation) => {
    const { error } = await supabase.from("push_automations").update({ active: !a.active } as any).eq("id", a.id);
    if (error) return toast.error("Erro ao atualizar");
    toast.success(!a.active ? "Ativada" : "Desativada");
    await onChanged();
  };

  const remove = async (a: Automation) => {
    if (!confirm(`Apagar "${a.name || a.title}"?`)) return;
    const { error } = await supabase.from("push_automations").delete().eq("id", a.id);
    if (error) return toast.error("Erro ao apagar");
    toast.success("Apagada");
    await onChanged();
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-gradient-to-br from-neon-pink/[0.08] via-black/30 to-neon-cyan/[0.05] p-5">
        <div>
          <h3 className="font-display text-xl font-black text-white">Minhas automações</h3>
          <p className="mt-1 text-xs text-white/60">
            Crie quantas quiser, do jeito que quiser. Rodam sozinhas a cada 5 minutos.
          </p>
        </div>
        <button
          onClick={() => setPicking(true)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon-pink to-purple-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-neon-pink/30 transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Nova automação
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-neon-pink/30 to-neon-cyan/20">
            <Wand2 className="h-6 w-6 text-white" />
          </div>
          <h4 className="mt-4 font-display text-lg font-black text-white">Nenhuma automação ainda</h4>
          <p className="mx-auto mt-1 max-w-sm text-xs text-white/60">
            Automações mandam push sozinhas — aniversário, carrinho abandonado, cliente inativo, boas-vindas, pós-pedido…
            Você escolhe o gatilho, o timing, o filtro e a mensagem.
          </p>
          <button
            onClick={() => setPicking(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-neon-pink/40 bg-neon-pink/10 px-4 py-2 text-xs font-black text-neon-pink hover:bg-neon-pink/20"
          >
            <Plus className="h-3.5 w-3.5" /> Criar primeira automação
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => {
            const meta = AUTO_META[a.kind];
            const Icon = meta.icon;
            return (
              <div
                key={a.id}
                className={`group relative overflow-hidden rounded-2xl border p-4 transition ${
                  a.active
                    ? "border-white/15 bg-gradient-to-br from-black/50 to-purple-950/30 hover:border-neon-pink/40"
                    : "border-white/5 bg-black/20 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/50 ring-1 ${meta.ring} ${meta.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[10px] font-black uppercase tracking-wider ${meta.accent}`}>
                      {meta.label}
                    </div>
                    <div className="truncate text-sm font-black text-white">{a.name || a.title}</div>
                    <div className="mt-0.5 text-[11px] text-neon-cyan">
                      {summarizeConfig(a.kind, a.config, a.filters)}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(a)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                      a.active ? "bg-neon-pink/20 text-neon-pink" : "bg-white/5 text-white/40"
                    }`}
                  >
                    <Power className="h-2.5 w-2.5" /> {a.active ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="mt-3 rounded-xl border border-white/5 bg-black/30 p-2">
                  <div className="truncate text-[11px] font-bold text-white">{a.title}</div>
                  <div className="line-clamp-2 text-[11px] text-white/50">{a.body}</div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-white/40">
                  <span>
                    {a.last_run_at ? `Última: ${new Date(a.last_run_at).toLocaleString("pt-BR")}` : "Ainda não rodou"}
                  </span>
                  <div className="flex gap-1">
                    <IconBtn onClick={() => setEditing(a)} title="Editar" tone="cyan"><Pencil className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn onClick={() => remove(a)} title="Apagar" tone="red"><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {picking && (
        <KindPicker
          onClose={() => setPicking(false)}
          onPick={(k) => { setPicking(false); setCreating(k); }}
        />
      )}

      {creating && (
        <AutomationEditor
          initial={{ kind: creating, active: true, config: {}, filters: {} } as any}
          onClose={() => setCreating(null)}
          onSaved={async () => { setCreating(null); await onChanged(); }}
        />
      )}

      {editing && (
        <AutomationEditor
          initial={editing as any}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await onChanged(); }}
        />
      )}
    </section>
  );
}

function KindPicker({ onClose, onPick }: { onClose: () => void; onPick: (k: AutoKind) => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.14_0.08_305)] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-neon-pink" />
            <span className="font-black">Escolha o gatilho</span>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-2 p-4">
          {KIND_OPTIONS.map((k) => {
            const meta = AUTO_META[k];
            const Icon = meta.icon;
            return (
              <button
                key={k}
                onClick={() => onPick(k)}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-left transition hover:border-neon-pink/40 hover:bg-neon-pink/[0.05]"
              >
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/50 ring-1 ${meta.ring} ${meta.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-white">{meta.label}</div>
                  <p className="text-[11px] text-white/60">{meta.hint}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AutomationEditor({
  initial, onClose, onSaved,
}: {
  initial: Partial<Automation> & { kind: AutoKind };
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial.id;
  const [name, setName] = useState(initial.name ?? "");
  const [title, setTitle] = useState(initial.title ?? "");
  const [body, setBody] = useState(initial.body ?? "");
  const [url, setUrl] = useState(initial.url ?? "");
  const [image, setImage] = useState(initial.image ?? "");
  const [cfg, setCfg] = useState<Record<string, any>>({ ...(initial.config ?? {}) });
  const [filters, setFilters] = useState<Record<string, any>>({ ...(initial.filters ?? {}) });
  const [saving, setSaving] = useState(false);

  const setC = (k: string, v: any) => setCfg((c) => ({ ...c, [k]: v }));
  const setF = (k: string, v: any) =>
    setFilters((f) => {
      const n = { ...f };
      if (v === "" || v == null || Number.isNaN(v)) delete n[k];
      else n[k] = v;
      return n;
    });
  const kind = initial.kind;
  const meta = AUTO_META[kind];
  const Icon = meta.icon;

  const save = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Preencha título e mensagem.");
      return;
    }
    setSaving(true);
    try {
      const patch: any = {
        kind,
        name: name.trim() || meta.label,
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || null,
        image: image.trim() || null,
        config: cfg,
        filters,
      };
      if (isNew) patch.active = true;
      const q = isNew
        ? supabase.from("push_automations").insert(patch)
        : supabase.from("push_automations").update(patch).eq("id", initial.id!);
      const { error } = await q;
      if (error) throw error;
      toast.success(isNew ? "Automação criada" : "Automação salva");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[oklch(0.13_0.08_305)] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`relative overflow-hidden border-b border-white/10 px-5 py-4`}>
          <div className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl ${
            meta.accent.replace("text-", "bg-")
          } opacity-30`} />
          <div className="relative flex items-center gap-3">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/50 ring-1 ${meta.ring} ${meta.accent}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-[10px] font-black uppercase tracking-wider ${meta.accent}`}>
                {isNew ? "Nova automação" : "Editando"}
              </div>
              <div className="truncate font-black">{meta.label}</div>
            </div>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <Field label="Apelido (só você vê)">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={meta.label} className={inputCls} />
          </Field>

          <FieldGroup icon={Zap} label="Quando disparar" tone="pink">
            {kind === "birthday" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Hora do dia (0-23)">
                  <input
                    type="number" min={0} max={23}
                    value={cfg.hour ?? 9}
                    onChange={(e) => setC("hour", Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Dias em relação ao aniversário" hint="negativo = antes · 0 = no dia · positivo = depois">
                  <input
                    type="number"
                    value={cfg.days_offset ?? 0}
                    onChange={(e) => setC("days_offset", Number(e.target.value) || 0)}
                    className={inputCls}
                  />
                </Field>
              </div>
            )}
            {(kind === "welcome" || kind === "after_order") && (
              <div className="space-y-3">
                <Field label="Atraso após o pedido (minutos)" hint="60 = 1h · 1440 = 1 dia">
                  <input
                    type="number" min={0}
                    value={cfg.delay_minutes ?? 60}
                    onChange={(e) => setC("delay_minutes", Math.max(0, Number(e.target.value) || 0))}
                    className={inputCls}
                  />
                </Field>
                {kind === "after_order" && (
                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={Boolean(cfg.only_first)}
                      onChange={(e) => setC("only_first", e.target.checked)}
                    />
                    Só no primeiro pedido do cliente
                  </label>
                )}
              </div>
            )}
            {kind === "dormant" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Sem comprar há quantos dias">
                  <input
                    type="number" min={1} max={365}
                    value={cfg.days ?? 30}
                    onChange={(e) => setC("days", Math.max(1, Math.min(365, Number(e.target.value) || 30)))}
                    className={inputCls}
                  />
                </Field>
                <label className="mt-6 flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={Boolean(cfg.repeat_weekly)}
                    onChange={(e) => setC("repeat_weekly", e.target.checked)}
                  />
                  Repetir toda semana
                </label>
              </div>
            )}
            {kind === "abandoned_cart" && (
              <Field label="Minutos após o cliente abandonar">
                <input
                  type="number" min={1}
                  value={cfg.delay_minutes ?? 15}
                  onChange={(e) => setC("delay_minutes", Math.max(1, Number(e.target.value) || 15))}
                  className={inputCls}
                />
              </Field>
            )}
          </FieldGroup>

          <FieldGroup icon={Filter} label="Filtro de público (opcional)" tone="cyan">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mínimo de pedidos">
                <input type="number" min={0} value={filters.min_orders ?? ""} onChange={(e) => setF("min_orders", e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} className={inputCls} />
              </Field>
              <Field label="Máximo de pedidos">
                <input type="number" min={0} value={filters.max_orders ?? ""} onChange={(e) => setF("max_orders", e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} className={inputCls} />
              </Field>
              <Field label="Já gastou pelo menos (R$)">
                <input type="number" min={0} value={filters.min_spent_total ?? ""} onChange={(e) => setF("min_spent_total", e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} className={inputCls} />
              </Field>
              <Field label="Comprou nos últimos (dias)">
                <input type="number" min={1} value={filters.ordered_within_days ?? ""} onChange={(e) => setF("ordered_within_days", e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))} className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Sem compra há pelo menos (dias)">
                  <input type="number" min={1} value={filters.not_ordered_within_days ?? ""} onChange={(e) => setF("not_ordered_within_days", e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))} className={inputCls} />
                </Field>
              </div>
            </div>
          </FieldGroup>

          <FieldGroup icon={MessageSquare} label="Mensagem" tone="yellow">
            <Field label="Título">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Ex.: 🎂 Feliz aniversário!" className={inputCls} />
            </Field>
            <Field label="Corpo">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={180} placeholder="Escreva a mensagem..." className={`${inputCls} resize-none`} />
              <div className="mt-1 flex flex-wrap gap-1">
                {["{{primeiro_nome}}", "{{nome}}"].map((tok) => (
                  <button
                    key={tok}
                    type="button"
                    onClick={() => setBody((b) => (b + " " + tok).trim())}
                    className="rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2 py-0.5 text-[10px] font-bold text-neon-cyan hover:bg-neon-cyan/20"
                  >
                    + {tok}
                  </button>
                ))}
              </div>
            </Field>
            <LinkPicker value={url} onChange={setUrl} />
            <Field label="Imagem (opcional)">
              <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." className={inputCls} />
            </Field>

          </FieldGroup>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 bg-black/30 px-5 py-4">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/5">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon-pink to-purple-600 px-5 py-2 text-sm font-black text-white shadow-lg shadow-neon-pink/30 transition hover:brightness-110 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isNew ? "Criar automação" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit campaign modal (same visual language)

function EditCampaignModal({
  campaign, onClose, onSaved,
}: { campaign: Campaign; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(campaign.title);
  const [body, setBody] = useState(campaign.body);
  const [url, setUrl] = useState(campaign.url ?? "");
  const [image, setImage] = useState(campaign.image ?? "");
  const [durationMin, setDurationMin] = useState<number | null | "keep">("keep");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = {
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || null,
        image: image.trim() || null,
      };
      if (durationMin !== "keep") {
        patch.expires_at = durationMin === null ? null : new Date(Date.now() + durationMin * 60_000).toISOString();
      }
      const { error } = await supabase.from("push_campaigns").update(patch as any).eq("id", campaign.id);
      if (error) throw error;
      toast.success("Atualizada");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.13_0.08_305)] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-neon-cyan" />
            <span className="font-black">Editar notificação</span>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <Field label="Título"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className={inputCls} /></Field>
          <Field label="Mensagem"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={180} className={`${inputCls} resize-none`} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Link"><input value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} /></Field>
            <Field label="Imagem"><input value={image} onChange={(e) => setImage(e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label={<><Clock className="mr-1 inline h-3 w-3" /> Redefinir tempo visível</>}>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDurationMin("keep")}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  durationMin === "keep" ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan" : "border-white/10 bg-black/20 text-white/70 hover:border-white/30"
                }`}
              >
                Manter atual
              </button>
              {durationOptions.map((d) => {
                const active = durationMin === d.value;
                return (
                  <button
                    key={String(d.value)}
                    type="button"
                    onClick={() => setDurationMin(d.value)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      active ? "border-neon-yellow bg-neon-yellow/15 text-neon-yellow" : "border-white/10 bg-black/20 text-white/70 hover:border-white/30"
                    }`}
                  >
                    {d.value === null ? <InfinityIcon className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {d.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 bg-black/30 px-5 py-4">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/5">Cancelar</button>
          <button
            onClick={save}
            disabled={saving || !title.trim() || !body.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-neon-cyan px-5 py-2 text-sm font-black text-[oklch(0.14_0.08_305)] transition hover:brightness-110 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small primitives

const inputCls =
  "mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-neon-pink focus:bg-black/60";

function Field({
  label, hint, children,
}: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-white/70">{label}</label>
        {hint && <span className="text-[10px] text-white/40">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function FieldGroup({
  icon: Icon, label, tone, children,
}: { icon: typeof Users; label: string; tone: "pink" | "cyan" | "yellow"; children: React.ReactNode }) {
  const t =
    tone === "pink"
      ? "text-neon-pink border-neon-pink/20 bg-neon-pink/[0.04]"
      : tone === "cyan"
      ? "text-neon-cyan border-neon-cyan/20 bg-neon-cyan/[0.04]"
      : "text-neon-yellow border-neon-yellow/20 bg-neon-yellow/[0.04]";
  return (
    <div className={`rounded-2xl border p-4 ${t.split(" ").slice(1).join(" ")}`}>
      <div className={`mb-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${t.split(" ")[0]}`}>
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LinkPicker — collapsible accordion with URL + product picker

const QUICK_LINKS = [
  { label: "Página inicial", value: "/" },
  { label: "Carrinho", value: "/carrinho" },
  { label: "Recompensas", value: "/recompensas" },
  { label: "Baixar app", value: "/baixar-app" },
];

function LinkPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(Boolean(value));
  const [picking, setPicking] = useState(false);

  const label = useMemo(() => {
    if (!value) return "Nenhum — abre a home";
    const quick = QUICK_LINKS.find((q) => q.value === value);
    if (quick) return quick.label;
    const m = value.match(/^\/produto\/(.+)$/);
    if (m) return `Produto · ${m[1].slice(0, 8)}…`;
    return value;
  }, [value]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Link2 className="h-4 w-4 text-neon-cyan" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-white/80">Link ao tocar (opcional)</div>
            <div className="truncate text-[11px] text-white/50">{label}</div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-white/10 p-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_LINKS.map((q) => {
              const active = value === q.value;
              return (
                <button
                  key={q.value}
                  type="button"
                  onClick={() => onChange(q.value)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                    active
                      ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan"
                      : "border-white/10 bg-black/30 text-white/70 hover:border-white/30"
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="inline-flex items-center gap-1 rounded-full border border-neon-pink/40 bg-neon-pink/10 px-3 py-1 text-[11px] font-bold text-neon-pink hover:bg-neon-pink/20"
            >
              <Package className="h-3 w-3" /> Escolher produto
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-bold text-white/50 hover:bg-white/10"
              >
                Limpar
              </button>
            )}
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              Ou cole uma URL/caminho
            </label>
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="/ · /produto/id · https://…"
              className={inputCls}
            />
          </div>
        </div>
      )}

      {picking && (
        <ProductPickerModal
          onClose={() => setPicking(false)}
          onPick={(id) => { onChange(`/produto/${id}`); setPicking(false); }}
        />
      )}
    </div>
  );
}

function ProductPickerModal({
  onClose, onPick,
}: { onClose: () => void; onPick: (id: string) => void }) {
  const [items, setItems] = useState<{ id: string; name: string; image_url: string | null; category_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,image_url,category_id")
        .order("name");
      setItems((data ?? []) as any);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((p) => p.name.toLowerCase().includes(s));
  }, [items, q]);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.13_0.08_305)] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-neon-pink" />
            <span className="font-black">Escolher produto</span>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-white/10 p-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/40">Nenhum produto encontrado.</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onPick(p.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-black/20 p-2 text-left transition hover:border-neon-pink/40 hover:bg-neon-pink/[0.06]"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/40">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-white">{p.name}</div>
                      <div className="truncate text-[10px] text-white/40">/produto/{p.id}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

