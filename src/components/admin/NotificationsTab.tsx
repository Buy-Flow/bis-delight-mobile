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
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Enviando..." : "Enviar agora"}
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
