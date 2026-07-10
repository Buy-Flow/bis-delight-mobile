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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Audience = "all" | "recent_30d" | "birthday_month" | "dormant_60d";

const audiences: { value: Audience; label: string; icon: typeof Users; hint: string }[] = [
  { value: "all", label: "Todos os inscritos", icon: Globe, hint: "Qualquer pessoa que ativou notificações" },
  { value: "recent_30d", label: "Compraram nos últimos 30 dias", icon: Users, hint: "Clientes ativos" },
  { value: "birthday_month", label: "Aniversariantes do mês", icon: Cake, hint: "Cadastraram data de nascimento" },
  { value: "dormant_60d", label: "Sem compra há 60+ dias", icon: Moon, hint: "Traga eles de volta" },
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
}

export function NotificationsTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [sending, setSending] = useState(false);
  const [totalSubs, setTotalSubs] = useState<number | null>(null);
  const [history, setHistory] = useState<Campaign[]>([]);

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
        .limit(20),
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
    setSending(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: campaign, error } = await supabase
        .from("push_campaigns")
        .insert({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || null,
          image: image.trim() || null,
          audience,
          created_by: user.user?.id ?? null,
        })
        .select()
        .single();
      if (error || !campaign) throw error;

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
      setTitle("");
      setBody("");
      setUrl("");
      setImage("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setSending(false);
    }
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
                {history.map((c) => (
                  <li key={c.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="truncate text-sm font-bold">{c.title}</div>
                    <div className="line-clamp-2 text-[11px] text-white/60">{c.body}</div>
                    <div className="mt-2 flex justify-between text-[10px] text-white/40">
                      <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                      <span>
                        {c.sent_count} enviadas · {c.opened_count} abertas
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
