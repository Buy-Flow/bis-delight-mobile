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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Audience = "all" | "recent_30d" | "birthday_month" | "dormant_60d";

const audiences: { value: Audience; label: string; icon: typeof Users; hint: string }[] = [
  { value: "all", label: "Todos os inscritos", icon: Globe, hint: "Qualquer pessoa que ativou notificações" },
  { value: "recent_30d", label: "Compraram nos últimos 30 dias", icon: Users, hint: "Clientes ativos" },
  { value: "birthday_month", label: "Aniversariantes do mês", icon: Cake, hint: "Cadastraram data de nascimento" },
  { value: "dormant_60d", label: "Sem compra há 60+ dias", icon: Moon, hint: "Traga eles de volta" },
];

const durationOptions: { value: number | null; label: string }[] = [
  { value: 10, label: "10 min" },
  { value: 60, label: "1 hora" },
  { value: 60 * 6, label: "6 horas" },
  { value: 60 * 24, label: "24 horas" },
  { value: 60 * 24 * 3, label: "3 dias" },
  { value: 60 * 24 * 7, label: "7 dias" },
  { value: null, label: "Nunca expira" },
];

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
}

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

export function NotificationsTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [durationMin, setDurationMin] = useState<number | null>(60 * 24);
  const [sending, setSending] = useState(false);
  const [totalSubs, setTotalSubs] = useState<number | null>(null);
  const [history, setHistory] = useState<Campaign[]>([]);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string>(""); // local datetime-local value

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const [{ count }, { data: campaigns }] = await Promise.all([
      supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
      supabase
        .from("push_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setTotalSubs(count ?? 0);
    setHistory((campaigns ?? []) as Campaign[]);
  }

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
        toast.success(
          `Agendada para ${new Date(scheduledIso).toLocaleString("pt-BR")} — vai disparar sozinha.`,
        );
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
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(c: Campaign) {
    if (!confirm(`Apagar a notificação "${c.title}"? Ela sumirá para todos os clientes.`)) return;
    const { error } = await supabase.from("push_campaigns").delete().eq("id", c.id);
    if (error) {
      toast.error("Erro ao apagar");
      return;
    }
    toast.success("Notificação apagada");
    await refresh();
  }

  async function handleExpireNow(c: Campaign) {
    const { error } = await supabase
      .from("push_campaigns")
      .update({ expires_at: new Date().toISOString() } as any)
      .eq("id", c.id);
    if (error) {
      toast.error("Erro ao expirar");
      return;
    }
    toast.success("Notificação expirada — sumiu para os clientes");
    await refresh();
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-2xl font-black">Notificações</h2>
        <p className="text-xs text-white/50">
          Envie campanhas push para os dispositivos inscritos.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4 rounded-2xl border border-purple-900/50 bg-purple-950/30 p-5">
          <div>
            <label className="text-xs font-semibold text-white/60">Título</label>
            <input
              type="text"
              maxLength={60}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: 🍧 Sorvete novo chegou!"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
            />
            <span className="text-[10px] text-white/40">{title.length}/60</span>
          </div>
          <div>
            <label className="text-xs font-semibold text-white/60">Mensagem</label>
            <textarea
              rows={3}
              maxLength={180}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreva a mensagem que vai aparecer na notificação..."
              className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
            />
            <span className="text-[10px] text-white/40">{body.length}/180</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Personalizar:
              </span>
              {[
                { tok: "{{primeiro_nome}}", label: "primeiro nome" },
                { tok: "{{nome}}", label: "nome completo" },
              ].map((v) => (
                <button
                  key={v.tok}
                  type="button"
                  onClick={() => setBody((b) => (b + " " + v.tok).trim())}
                  className="rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-neon-cyan hover:bg-neon-cyan/20"
                  title={`Insere ${v.tok} — trocado pelo ${v.label} de cada cliente`}
                >
                  + {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-white/60">Link ao tocar (opcional)</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/ ou /produto/id"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-white/60">
                <ImageIcon className="h-3 w-3" /> Imagem (opcional)
              </label>
              <input
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="URL da imagem (aparece no Android)"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-white/60">
              <Clock className="h-3 w-3" /> Quanto tempo fica visível
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {durationOptions.map((d) => {
                const active = durationMin === d.value;
                return (
                  <button
                    key={String(d.value)}
                    type="button"
                    onClick={() => setDurationMin(d.value)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
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
            <p className="mt-1 text-[10px] text-white/40">
              Após esse tempo a notificação some do sino e do histórico dos clientes.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-white/60">Público</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {audiences.map((a) => {
                const Icon = a.icon;
                const active = audience === a.value;
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAudience(a.value)}
                    className={`rounded-xl border p-3 text-left text-sm transition ${
                      active
                        ? "border-neon-pink bg-neon-pink/15 text-white"
                        : "border-white/10 bg-black/20 text-white/70 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <Icon className="h-4 w-4" />
                      {a.label}
                    </div>
                    <p className="mt-1 text-[11px] text-white/50">{a.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <label className="flex items-center gap-1 text-xs font-semibold text-white/60">
              <CalendarClock className="h-3 w-3" /> Agendar envio (opcional)
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink [color-scheme:dark]"
              />
              {scheduledAt && (
                <button
                  type="button"
                  onClick={() => setScheduledAt("")}
                  className="text-[11px] text-white/50 underline hover:text-white"
                >
                  limpar
                </button>
              )}
              <span className="text-[10px] text-white/40">
                {scheduledAt
                  ? `Vai disparar em ${new Date(scheduledAt).toLocaleString("pt-BR")}`
                  : "Deixe vazio pra enviar agora."}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <p className="text-xs text-white/60">
              {totalSubs !== null ? (
                <>
                  <span className="font-bold text-white">{totalSubs}</span> dispositivos com
                  notificações ativas.
                </>
              ) : (
                "Carregando..."
              )}
            </p>
            <button
              onClick={handleSend}
              disabled={sending || !title.trim() || !body.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-neon-pink px-5 py-2 text-sm font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : scheduledAt ? (
                <CalendarClock className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending
                ? scheduledAt
                  ? "Agendando..."
                  : "Enviando..."
                : scheduledAt
                ? "Agendar envio"
                : "Enviar agora"}
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-purple-900/50 bg-black/40 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">Prévia</p>
            <div className="flex gap-3 rounded-xl bg-white/95 p-3 text-black shadow-lg">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2a1240]">
                <BellRing className="h-5 w-5 text-neon-yellow" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase text-black/50">Quero Bis</div>
                <div className="truncate font-bold">{preview.title}</div>
                <div className="line-clamp-2 text-xs text-black/70">{preview.body}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-purple-900/50 bg-purple-950/30 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">Histórico</p>
            {history.length === 0 ? (
              <p className="text-xs text-white/40">Nenhuma campanha enviada ainda.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((c) => {
                  const rem = fmtRemaining(c.expires_at);
                  return (
                    <li
                      key={c.id}
                      className={`rounded-xl border p-3 ${
                        rem.expired
                          ? "border-white/5 bg-black/30 opacity-60"
                          : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold">{c.title}</div>
                          <div className="line-clamp-2 text-[11px] text-white/60">{c.body}</div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => setEditing(c)}
                            aria-label="Editar"
                            className="grid h-7 w-7 place-items-center rounded-full text-neon-cyan hover:bg-white/10"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            aria-label="Apagar"
                            className="grid h-7 w-7 place-items-center rounded-full text-red-400 hover:bg-white/10"
                            title="Apagar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-white/40">
                        <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                        <span className="flex items-center gap-2">
                          <span>
                            {c.sent_count} enviadas · {c.opened_count} abertas
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                              rem.expired
                                ? "bg-white/5 text-white/40"
                                : c.expires_at
                                ? "bg-neon-yellow/15 text-neon-yellow"
                                : "bg-white/5 text-white/50"
                            }`}
                          >
                            {c.expires_at ? <Clock className="h-2.5 w-2.5" /> : <InfinityIcon className="h-2.5 w-2.5" />}
                            {rem.label}
                          </span>
                          {!rem.expired && c.expires_at && (
                            <button
                              onClick={() => handleExpireNow(c)}
                              className="rounded-full bg-white/5 px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
                              title="Expirar agora (some para os clientes)"
                            >
                              Expirar agora
                            </button>
                          )}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <ScheduledCampaigns history={history} onChanged={refresh} />

      <AutomationsPanel />

      {editing && (
        <EditCampaignModal
          campaign={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function EditCampaignModal({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: Campaign;
  onClose: () => void;
  onSaved: () => void;
}) {
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
        patch.expires_at =
          durationMin === null ? null : new Date(Date.now() + durationMin * 60_000).toISOString();
      }
      const { error } = await supabase.from("push_campaigns").update(patch as any).eq("id", campaign.id);
      if (error) throw error;
      toast.success("Notificação atualizada");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.14_0.08_305)] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-neon-cyan" />
            <span className="font-bold">Editar notificação</span>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <label className="text-xs font-semibold text-white/60">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/60">Mensagem</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={180}
              className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-white/60">Link (opcional)</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60">Imagem (opcional)</label>
              <input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-white/60">
              <Clock className="h-3 w-3" /> Redefinir tempo visível
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDurationMin("keep")}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  durationMin === "keep"
                    ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan"
                    : "border-white/10 bg-black/20 text-white/70 hover:border-white/30"
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
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
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
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 bg-black/20 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || !title.trim() || !body.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-neon-cyan px-5 py-2 text-sm font-bold text-[oklch(0.14_0.08_305)] transition hover:brightness-110 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Scheduled campaigns preview

function ScheduledCampaigns({ history, onChanged }: { history: Campaign[]; onChanged: () => Promise<void> | void }) {
  const scheduled = history.filter((c: any) => c.status === "scheduled" && c.scheduled_for);
  if (scheduled.length === 0) return null;

  async function cancel(c: Campaign) {
    if (!confirm(`Cancelar o envio agendado de "${c.title}"?`)) return;
    const { error } = await supabase
      .from("push_campaigns")
      .update({ status: "canceled" } as any)
      .eq("id", c.id);
    if (error) {
      toast.error("Erro ao cancelar");
      return;
    }
    toast.success("Envio agendado cancelado");
    await onChanged();
  }

  return (
    <section className="mt-6 rounded-2xl border border-neon-cyan/30 bg-neon-cyan/[0.05] p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-neon-cyan" />
        <h3 className="font-display text-lg font-black">Envios agendados</h3>
        <span className="rounded-full bg-neon-cyan/15 px-2 py-0.5 text-[10px] font-bold text-neon-cyan">
          {scheduled.length}
        </span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {scheduled.map((c: any) => (
          <li key={c.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{c.title}</div>
              <div className="line-clamp-2 text-[11px] text-white/60">{c.body}</div>
              <div className="mt-1 text-[10px] text-neon-cyan">
                🗓️ {new Date(c.scheduled_for).toLocaleString("pt-BR")}
              </div>
            </div>
            <button
              onClick={() => cancel(c)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-red-400 hover:bg-white/10"
              title="Cancelar envio"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Automations panel — multiple per kind, configurable triggers + filters

type AutoKind = "birthday" | "dormant" | "welcome" | "after_order" | "abandoned_cart";

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
}

const AUTO_META: Record<AutoKind, { label: string; hint: string; icon: typeof Gift; accent: string }> = {
  birthday: {
    label: "Aniversário",
    hint: "Dia do aniversário (ou N dias antes/depois) em uma hora escolhida.",
    icon: Cake,
    accent: "text-neon-yellow",
  },
  welcome: {
    label: "Boas-vindas (1º pedido)",
    hint: "Após o primeiro pedido, com atraso configurável.",
    icon: UserPlus,
    accent: "text-neon-pink",
  },
  after_order: {
    label: "Após pedido",
    hint: "Após cada pedido pago, com atraso em minutos/horas.",
    icon: Sparkles,
    accent: "text-neon-cyan",
  },
  dormant: {
    label: "Cliente inativo",
    hint: "Quem não pede há X dias. Ideal em degraus (7, 30, 60…).",
    icon: Moon,
    accent: "text-neon-cyan",
  },
  abandoned_cart: {
    label: "Carrinho abandonado",
    hint: "X minutos depois do cliente parar sem finalizar.",
    icon: Zap,
    accent: "text-neon-pink",
  },
};

const KIND_ORDER: AutoKind[] = ["birthday", "welcome", "after_order", "dormant", "abandoned_cart"];

function defaultForKind(kind: AutoKind): Partial<Automation> {
  switch (kind) {
    case "birthday":
      return {
        name: "Feliz aniversário",
        title: "🎂 Feliz aniversário, {{primeiro_nome}}!",
        body: "Hoje o mimo é por nossa conta. Passa aqui e aproveita 🎉",
        url: "/", config: { hour: 9, days_offset: 0 }, filters: {},
      };
    case "welcome":
      return {
        name: "Boas-vindas ao 1º pedido",
        title: "Obrigado pelo primeiro pedido, {{primeiro_nome}}! 🍧",
        body: "Volta sempre — cada 10 pedidinhos rende um brinde 🎁",
        url: "/recompensas", config: { delay_minutes: 60 }, filters: {},
      };
    case "after_order":
      return {
        name: "Agradecer após pedido",
        title: "Deu tudo certo? 💜",
        body: "Se curtiu, conta pra gente! Sua opinião ajuda demais.",
        url: "/", config: { delay_minutes: 60, only_first: false }, filters: {},
      };
    case "dormant":
      return {
        name: "Cliente inativo",
        title: "A gente sentiu sua falta, {{primeiro_nome}} 💜",
        body: "Faz tempo que você não pede… que tal um docinho pra hoje?",
        url: "/", config: { days: 30, repeat_weekly: false }, filters: {},
      };
    case "abandoned_cart":
      return {
        name: "Recuperar carrinho",
        title: "Esqueceu algo, {{primeiro_nome}}? 🛒",
        body: "Seu carrinho está te esperando. Finaliza rapidinho!",
        url: "/carrinho", config: { delay_minutes: 15 }, filters: {},
      };
  }
}

function AutomationsPanel() {
  const [items, setItems] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<AutoKind | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("push_automations")
      .select("*")
      .order("kind")
      .order("created_at");
    setItems((data ?? []) as Automation[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    const g: Record<AutoKind, Automation[]> = {
      birthday: [], welcome: [], after_order: [], dormant: [], abandoned_cart: [],
    };
    for (const a of items) if (g[a.kind]) g[a.kind].push(a);
    return g;
  }, [items]);

  return (
    <section className="mt-6 rounded-2xl border border-neon-pink/30 bg-gradient-to-br from-neon-pink/[0.06] to-purple-950/40 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-neon-pink" />
        <h3 className="font-display text-lg font-black">Automações</h3>
        <span className="text-[10px] text-white/40">
          Rodam sozinhas a cada 5 min. Personalize com {"{{primeiro_nome}}"} / {"{{nome}}"}.
        </span>
      </div>

      {loading ? (
        <div className="grid place-items-center py-8 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {KIND_ORDER.map((kind) => {
            const meta = AUTO_META[kind];
            const Icon = meta.icon;
            const list = grouped[kind];
            return (
              <div key={kind} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-start gap-2">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black/40 ${meta.accent}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white">{meta.label}</div>
                    <p className="text-[11px] text-white/50">{meta.hint}</p>
                  </div>
                  <button
                    onClick={() => setCreating(kind)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neon-pink/20 px-3 py-1 text-[11px] font-bold text-neon-pink hover:bg-neon-pink/30"
                  >
                    <Sparkles className="h-3 w-3" /> Nova
                  </button>
                </div>
                {list.length === 0 ? (
                  <p className="text-[11px] text-white/40">Nenhuma automação configurada.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {list.map((a) => (
                      <AutomationCard key={a.id} automation={a} onChanged={load} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <AutomationEditor
          initial={{ kind: creating, active: true, ...defaultForKind(creating) } as any}
          onClose={() => setCreating(null)}
          onSaved={async () => { setCreating(null); await load(); }}
        />
      )}
    </section>
  );
}

function AutomationCard({ automation, onChanged }: { automation: Automation; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);

  const toggleActive = async () => {
    const { error } = await supabase
      .from("push_automations")
      .update({ active: !automation.active } as any)
      .eq("id", automation.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(!automation.active ? "Automação ativada" : "Automação desativada");
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Apagar a automação "${automation.name || automation.title}"?`)) return;
    const { error } = await supabase.from("push_automations").delete().eq("id", automation.id);
    if (error) { toast.error("Erro ao apagar"); return; }
    toast.success("Automação apagada");
    onChanged();
  };

  return (
    <>
      <div className={`rounded-xl border p-3 transition ${
        automation.active ? "border-neon-pink/40 bg-black/30" : "border-white/10 bg-black/20 opacity-70"
      }`}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white">
              {automation.name || automation.title}
            </div>
            <div className="mt-1 truncate text-[11px] text-white/70">{automation.title}</div>
            <div className="line-clamp-2 text-[11px] text-white/50">{automation.body}</div>
            <div className="mt-1.5 text-[10px] text-neon-cyan">
              {summarizeConfig(automation.kind, automation.config, automation.filters)}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <button
              onClick={toggleActive}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                automation.active ? "bg-neon-pink/20 text-neon-pink" : "bg-white/5 text-white/40"
              }`}
            >
              <Power className="h-3 w-3" />{automation.active ? "Ativa" : "Off"}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="grid h-6 w-6 place-items-center rounded-full text-neon-cyan hover:bg-white/10"
              title="Editar"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={remove}
              className="grid h-6 w-6 place-items-center rounded-full text-red-400 hover:bg-white/10"
              title="Apagar"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        {automation.last_run_at && (
          <div className="mt-2 text-[10px] text-white/40">
            Última: {new Date(automation.last_run_at).toLocaleString("pt-BR")}
          </div>
        )}
      </div>
      {editing && (
        <AutomationEditor
          initial={automation as any}
          onClose={() => setEditing(false)}
          onSaved={async () => { setEditing(false); onChanged(); }}
        />
      )}
    </>
  );
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

function AutomationEditor({
  initial,
  onClose,
  onSaved,
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
  const setF = (k: string, v: any) => setFilters((f) => {
    const n = { ...f };
    if (v === "" || v == null || Number.isNaN(v)) delete n[k]; else n[k] = v;
    return n;
  });
  const kind = initial.kind;
  const meta = AUTO_META[kind];

  const save = async () => {
    if (!title.trim() || !body.trim()) { toast.error("Preencha título e mensagem."); return; }
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
    <div
      role="dialog"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[oklch(0.14_0.08_305)] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-neon-pink" />
            <span className="font-bold">{isNew ? "Nova automação" : "Editar automação"} — {meta.label}</span>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="text-xs font-semibold text-white/60">Apelido (só você vê)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={meta.label}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
            />
          </div>

          <div className="rounded-xl border border-neon-pink/20 bg-neon-pink/[0.05] p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neon-pink">Quando disparar</div>
            {kind === "birthday" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-white/70">
                  Hora do dia (0-23)
                  <input
                    type="number" min={0} max={23}
                    value={cfg.hour ?? 9}
                    onChange={(e) => setC("hour", Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-neon-pink"
                  />
                </label>
                <label className="text-xs text-white/70">
                  Dias em relação ao aniversário
                  <input
                    type="number"
                    value={cfg.days_offset ?? 0}
                    onChange={(e) => setC("days_offset", Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-neon-pink"
                  />
                  <span className="text-[10px] text-white/40">Negativo = antes, 0 = no dia, positivo = depois.</span>
                </label>
              </div>
            )}
            {(kind === "welcome" || kind === "after_order") && (
              <div className="space-y-2">
                <label className="text-xs text-white/70">
                  Atraso após o pedido (minutos)
                  <input
                    type="number" min={0}
                    value={cfg.delay_minutes ?? 60}
                    onChange={(e) => setC("delay_minutes", Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-neon-pink"
                  />
                  <span className="text-[10px] text-white/40">60 = 1h, 1440 = 1 dia.</span>
                </label>
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
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-white/70">
                  Sem comprar há quantos dias
                  <input
                    type="number" min={1} max={365}
                    value={cfg.days ?? 30}
                    onChange={(e) => setC("days", Math.max(1, Math.min(365, Number(e.target.value) || 30)))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-neon-pink"
                  />
                </label>
                <label className="mt-5 flex items-center gap-2 text-xs text-white/70">
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
              <label className="text-xs text-white/70">
                Minutos após o cliente abandonar
                <input
                  type="number" min={1}
                  value={cfg.delay_minutes ?? 15}
                  onChange={(e) => setC("delay_minutes", Math.max(1, Number(e.target.value) || 15))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-neon-pink"
                />
              </label>
            )}
          </div>

          <div className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/[0.04] p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neon-cyan">
              Filtro de público (opcional)
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-white/70">
                Mínimo de pedidos
                <input
                  type="number" min={0}
                  value={filters.min_orders ?? ""}
                  onChange={(e) => setF("min_orders", e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-neon-cyan"
                />
              </label>
              <label className="text-xs text-white/70">
                Máximo de pedidos
                <input
                  type="number" min={0}
                  value={filters.max_orders ?? ""}
                  onChange={(e) => setF("max_orders", e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-neon-cyan"
                />
              </label>
              <label className="text-xs text-white/70">
                Já gastou pelo menos (R$)
                <input
                  type="number" min={0}
                  value={filters.min_spent_total ?? ""}
                  onChange={(e) => setF("min_spent_total", e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-neon-cyan"
                />
              </label>
              <label className="text-xs text-white/70">
                Comprou nos últimos (dias)
                <input
                  type="number" min={1}
                  value={filters.ordered_within_days ?? ""}
                  onChange={(e) => setF("ordered_within_days", e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-neon-cyan"
                />
              </label>
              <label className="text-xs text-white/70 sm:col-span-2">
                Sem compra há pelo menos (dias)
                <input
                  type="number" min={1}
                  value={filters.not_ordered_within_days ?? ""}
                  onChange={(e) => setF("not_ordered_within_days", e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-neon-cyan"
                />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-xs font-semibold text-white/60">Título</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60">Mensagem</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={180}
                className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
              />
              <div className="mt-1 flex flex-wrap gap-1">
                {["{{primeiro_nome}}", "{{nome}}"].map((tok) => (
                  <button
                    key={tok}
                    type="button"
                    onClick={() => setBody((b) => (b + " " + tok).trim())}
                    className="rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-neon-cyan hover:bg-neon-cyan/20"
                  >
                    + {tok}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Link ao tocar (opcional)"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
              />
              <input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="URL da imagem (opcional)"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-pink"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 bg-black/20 px-4 py-3">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/5">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-neon-pink px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
