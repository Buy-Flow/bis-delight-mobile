import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyReferralCode } from "@/lib/referral";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Copy,
  Share2,
  MessageCircle,
  Gift,
  Users,
  Trophy,
  Sparkles,
  ChevronDown,
  QrCode,
  Send,
  Mail,
  Instagram,
  HelpCircle,
  ListChecks,
  Ticket,
  Pencil,
  ScrollText,
  Target,
  Search,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/indique")({
  head: () => ({ meta: [{ title: "Indique um amigo — Quero Bis" }] }),
  component: IndiquePage,
});

type Referral = {
  id: string;
  referee_email: string | null;
  referee_name: string | null;
  status: string;
  created_at: string;
  rewarded_at: string | null;
  referrer_coupon_code: string | null;
};

type Settings = {
  enabled: boolean;
  referrer_discount_type: "fixed" | "percent";
  referrer_discount_value: number;
  referrer_min_order: number;
  referee_discount_type: "fixed" | "percent";
  referee_discount_value: number;
  referee_min_order: number;
  expires_days: number;
  share_message: string;
};

const statusMeta: Record<string, { label: string; tone: string; dot: string }> = {
  signed_up: { label: "Cadastrou", tone: "bg-blue-500/15 text-blue-200 border-blue-400/20", dot: "bg-blue-400" },
  first_order_paid: { label: "Pediu", tone: "bg-amber-500/15 text-amber-200 border-amber-400/20", dot: "bg-amber-400" },
  rewarded: { label: "Recompensado", tone: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20", dot: "bg-emerald-400" },
  expired: { label: "Expirado", tone: "bg-white/5 text-white/50 border-white/10", dot: "bg-white/30" },
};

const sb = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: typeof supabase.from;
};

const MILESTONES = [1, 3, 5, 10, 25];

function Section({
  icon: Icon,
  title,
  subtitle,
  defaultOpen = false,
  badge,
  children,
  tone = "fuchsia",
}: {
  icon: typeof Gift;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
  tone?: "fuchsia" | "emerald" | "amber" | "sky";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toneMap = {
    fuchsia: "bg-fuchsia-500/15 text-fuchsia-200",
    emerald: "bg-emerald-500/15 text-emerald-200",
    amber: "bg-amber-500/15 text-amber-200",
    sky: "bg-sky-500/15 text-sky-200",
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition hover:bg-white/[0.03]"
      >
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white">{title}</div>
          {subtitle && <div className="truncate text-[11px] text-white/50">{subtitle}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && <div className="border-t border-white/10 p-4 md:p-5">{children}</div>}
    </section>
  );
}

function IndiquePage() {
  const [code, setCode] = useState<string | null>(null);
  const [refs, setRefs] = useState<Referral[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [customMsg, setCustomMsg] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "signed_up" | "first_order_paid" | "rewarded" | "expired">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [c, r, s] = await Promise.all([
        getMyReferralCode(),
        sb.rpc("get_my_referrals"),
        (
          supabase.from as unknown as (t: string) => {
            select: (c: string) => {
              eq: (a: string, b: number) => { maybeSingle: () => Promise<{ data: Settings | null }> };
            };
          }
        )("referral_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle(),
      ]);
      setCode(c);
      setRefs(((r.data as Referral[]) ?? []).filter(Boolean));
      setSettings(s.data as Settings | null);
      setCustomMsg((s.data as Settings | null)?.share_message ?? "Peço na Quero Bis 🍨");
      setLoading(false);
    })();
  }, []);

  const link = useMemo(() => {
    if (!code) return "";
    return `${window.location.origin}/r/${code}`;
  }, [code]);

  const rewardedCount = refs.filter((r) => r.status === "rewarded").length;
  const pendingCount = refs.filter((r) => r.status === "signed_up").length;
  const orderedCount = refs.filter((r) => r.status === "first_order_paid").length;

  const nextMilestone = MILESTONES.find((m) => rewardedCount < m) ?? MILESTONES[MILESTONES.length - 1];
  const progressPct = Math.min(100, Math.round((rewardedCount / nextMilestone) * 100));

  const format = (t: "fixed" | "percent", v: number) =>
    t === "percent" ? `${v}%` : `R$ ${Number(v).toFixed(2)}`;

  const shareText = useMemo(() => `${customMsg} ${link}`.trim(), [customMsg, link]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return refs.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!s) return true;
      return (
        (r.referee_name ?? "").toLowerCase().includes(s) ||
        (r.referee_email ?? "").toLowerCase().includes(s) ||
        (r.referrer_coupon_code ?? "").toLowerCase().includes(s)
      );
    });
  }, [refs, filter, search]);

  const earnedCoupons = refs.filter((r) => r.status === "rewarded" && r.referrer_coupon_code);

  const copy = async (text?: string) => {
    const t = text ?? link;
    if (!t) return;
    await navigator.clipboard.writeText(t);
    toast.success("Copiado!");
  };
  const share = async () => {
    if (!link) return;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "Quero Bis", text: shareText, url: link });
      } catch {
        /* cancelled */
      }
    } else {
      copy();
    }
  };
  const whatsapp = () =>
    link && window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  const telegram = () =>
    link &&
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(customMsg)}`,
      "_blank",
    );
  const email = () =>
    link &&
    window.open(
      `mailto:?subject=${encodeURIComponent("Peço na Quero Bis 🍨")}&body=${encodeURIComponent(shareText)}`,
    );
  const instagram = () => {
    copy(shareText);
    toast.info("Texto copiado — cola nos Stories/DM 📸");
  };

  const qrUrl = link
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&color=ffffff&bgcolor=0f0f14&data=${encodeURIComponent(link)}`
    : "";

  if (loading) return <div className="p-6 text-white/60">Carregando...</div>;

  if (settings && !settings.enabled) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-white/70">
        <Gift className="mx-auto mb-4 h-12 w-12 text-white/30" />
        <h1 className="mb-2 text-2xl font-bold text-white">Programa indisponível</h1>
        <p>O programa "Indique um amigo" está desativado no momento. Volte em breve!</p>
      </div>
    );
  }

  const refereeFmt = settings ? format(settings.referee_discount_type, settings.referee_discount_value) : "—";
  const referrerFmt = settings ? format(settings.referrer_discount_type, settings.referrer_discount_value) : "—";

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      {/* HERO */}
      <header className="relative overflow-hidden rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-600/25 via-purple-700/15 to-transparent p-5 md:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="relative grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-fuchsia-100">
              <Sparkles className="h-3 w-3" /> Indique & Ganhe
            </div>
            <h1 className="text-3xl font-black leading-tight text-white md:text-4xl">
              Chame a galera. <span className="text-fuchsia-300">Ganhem juntos.</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/75">
              Seu amigo ganha <b className="text-fuchsia-200">{refereeFmt}</b> no 1º pedido. Quando ele pedir, você recebe{" "}
              <b className="text-emerald-200">{referrerFmt}</b> em cupom.
            </p>
          </div>

          {/* Progress ring */}
          <div className="flex items-center gap-4 md:flex-col md:items-end">
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="url(#gradR)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${(progressPct / 100) * 264} 264`}
                />
                <defs>
                  <linearGradient id="gradR" x1="0" x2="1">
                    <stop offset="0" stopColor="#e879f9" />
                    <stop offset="1" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="text-lg font-black text-white">{rewardedCount}</div>
                  <div className="text-[9px] uppercase tracking-wider text-white/50">de {nextMilestone}</div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-white/50">Próximo nível</div>
              <div className="text-sm font-bold text-white">{nextMilestone} amigos</div>
            </div>
          </div>
        </div>
      </header>

      {/* SHARE PANEL */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/50">Seu link mágico</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={link} className="border-white/15 bg-black/30 font-mono text-white" />
          <Button onClick={() => copy()} className="gap-2 bg-white/15 text-white hover:bg-white/25">
            <Copy className="h-4 w-4" /> Copiar
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Button onClick={whatsapp} className="gap-2 bg-emerald-500 text-white hover:bg-emerald-600">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <Button onClick={telegram} className="gap-2 bg-sky-500 text-white hover:bg-sky-600">
            <Send className="h-4 w-4" /> Telegram
          </Button>
          <Button onClick={instagram} className="gap-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white hover:opacity-90">
            <Instagram className="h-4 w-4" /> Stories
          </Button>
          <Button onClick={email} className="gap-2 bg-white/10 text-white hover:bg-white/20">
            <Mail className="h-4 w-4" /> Email
          </Button>
          <Button onClick={share} variant="outline" className="gap-2 border-white/20 bg-white/5 text-white">
            <Share2 className="h-4 w-4" /> Outros
          </Button>
        </div>

        <p className="mt-3 text-[11px] text-white/50">
          Código:{" "}
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-fuchsia-200">{code}</span> • cupons
          expiram em {settings?.expires_days ?? 60} dias
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Users} label="Indicados" value={refs.length} tone="text-white/80" />
        <StatCard icon={Gift} label="Aguardando" value={pendingCount} tone="text-amber-300" />
        <StatCard icon={Ticket} label="Pediram" value={orderedCount} tone="text-sky-300" />
        <StatCard icon={Trophy} label="Recompensas" value={rewardedCount} tone="text-emerald-300" />
      </div>

      {/* ACCORDIONS */}
      <div className="space-y-3">
        <Section
          icon={ListChecks}
          title="Minhas indicações"
          subtitle={`${refs.length} no total • ${rewardedCount} recompensadas`}
          defaultOpen
          tone="fuchsia"
          badge={
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
              {filtered.length}
            </span>
          }
        >
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, email ou cupom…"
                className="border-white/15 bg-black/20 pl-9 text-white placeholder:text-white/40"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/50 hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "Todos"],
                  ["signed_up", "Cadastrou"],
                  ["first_order_paid", "Pediu"],
                  ["rewarded", "Recompensado"],
                  ["expired", "Expirado"],
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === k
                      ? "bg-fuchsia-500 text-white"
                      : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-white/50">
              {refs.length === 0
                ? "Nenhuma indicação ainda. Compartilhe seu link!"
                : "Nenhum resultado para o filtro atual."}
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((r) => {
                const s = statusMeta[r.status] ?? statusMeta.signed_up;
                return (
                  <li
                    key={r.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                        <div className="truncate text-sm font-semibold text-white">
                          {r.referee_name || r.referee_email || "Amigo"}
                        </div>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-white/50">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                        {r.referrer_coupon_code && (
                          <>
                            {" • cupom "}
                            <span className="font-mono text-emerald-300">{r.referrer_coupon_code}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.tone}`}>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          icon={Ticket}
          title="Meus cupons ganhos"
          subtitle={`${earnedCoupons.length} disponíveis`}
          tone="emerald"
          badge={
            earnedCoupons.length > 0 ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                {earnedCoupons.length}
              </span>
            ) : undefined
          }
        >
          {earnedCoupons.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-white/50">
              Você ainda não ganhou cupons. Continue indicando!
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {earnedCoupons.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-200/80">Cupom ativo</div>
                    <div className="truncate font-mono text-sm font-bold text-white">{r.referrer_coupon_code}</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => copy(r.referrer_coupon_code ?? "")}
                    className="gap-1 bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          icon={QrCode}
          title="QR Code do meu link"
          subtitle="Mostra na tela pra o amigo escanear na hora"
          tone="sky"
        >
          <div className="flex flex-col items-center gap-3">
            {qrUrl && (
              <img
                src={qrUrl}
                alt="QR Code do seu link de indicação"
                className="h-56 w-56 rounded-2xl border border-white/10 bg-black/40 p-2"
              />
            )}
            <div className="text-center text-xs text-white/60">
              Aponta a câmera aqui — cai direto no cadastro com seu código.
            </div>
            <Button
              onClick={() => qrUrl && window.open(qrUrl, "_blank")}
              variant="outline"
              className="gap-2 border-white/20 bg-white/5 text-white"
            >
              <Share2 className="h-4 w-4" /> Abrir em tamanho grande
            </Button>
          </div>
        </Section>

        <Section
          icon={Pencil}
          title="Personalize sua mensagem"
          subtitle="Edite o texto antes de compartilhar"
          tone="amber"
        >
          <Textarea
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
            rows={3}
            className="border-white/15 bg-black/20 text-white placeholder:text-white/40"
            placeholder="Ex: Testa esse açaí que é o melhor da cidade 🔥"
          />
          <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white/80">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-white/50">Prévia</div>
            {customMsg} <span className="font-mono text-fuchsia-200">{link}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => copy(shareText)} className="gap-2 bg-white/15 text-white hover:bg-white/25">
              <Copy className="h-4 w-4" /> Copiar mensagem
            </Button>
            <Button onClick={whatsapp} className="gap-2 bg-emerald-500 text-white hover:bg-emerald-600">
              <MessageCircle className="h-4 w-4" /> Enviar no Zap
            </Button>
          </div>
        </Section>

        <Section
          icon={Target}
          title="Metas & recompensas extras"
          subtitle={`Você está a ${Math.max(0, nextMilestone - rewardedCount)} amigo(s) do próximo nível`}
          tone="fuchsia"
        >
          <div className="space-y-2">
            {MILESTONES.map((m) => {
              const done = rewardedCount >= m;
              const pct = Math.min(100, Math.round((rewardedCount / m) * 100));
              return (
                <div
                  key={m}
                  className={`rounded-xl border p-3 ${
                    done ? "border-emerald-400/30 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-white">
                      {done ? (
                        <Check className="h-4 w-4 text-emerald-300" />
                      ) : (
                        <Trophy className="h-4 w-4 text-white/50" />
                      )}
                      <span className="font-bold">{m} amigos</span>
                      <span className="text-white/50">•</span>
                      <span className="text-white/70">{m === 1 ? "1º cupom" : `${m}× recompensas`}</span>
                    </div>
                    <span className={`text-xs ${done ? "text-emerald-300" : "text-white/50"}`}>
                      {rewardedCount}/{m}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        done ? "bg-emerald-400" : "bg-gradient-to-r from-fuchsia-500 to-purple-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section icon={HelpCircle} title="Como funciona" subtitle="3 passos" tone="sky">
          <ol className="space-y-2 text-sm text-white/80">
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fuchsia-500/20 text-xs font-bold text-fuchsia-200">
                1
              </span>
              Compartilhe seu link com quem ainda não tem cadastro.
            </li>
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fuchsia-500/20 text-xs font-bold text-fuchsia-200">
                2
              </span>
              Ao criar a conta, seu amigo ganha <b className="text-fuchsia-200">{refereeFmt}</b> (pedido mínimo R${" "}
              {settings?.referee_min_order.toFixed(2) ?? "—"}).
            </li>
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fuchsia-500/20 text-xs font-bold text-fuchsia-200">
                3
              </span>
              Quando ele pagar o 1º pedido, você recebe <b className="text-emerald-200">{referrerFmt}</b> em cupom
              automaticamente.
            </li>
          </ol>
        </Section>

        <Section icon={HelpCircle} title="Perguntas frequentes" tone="amber">
          <div className="space-y-3 text-sm">
            <Faq q="Meu amigo já tem conta, vale?">
              O programa é só para novos cadastros. Contas existentes não geram recompensa.
            </Faq>
            <Faq q="Quando meu cupom aparece?">
              Assim que o pagamento do 1º pedido do amigo é confirmado, seu cupom entra automático em "Meus cupons".
            </Faq>
            <Faq q="Posso indicar quantas pessoas?">
              Quantas quiser — não tem limite. Cada indicação recompensada vira um novo cupom.
            </Faq>
            <Faq q="O cupom expira?">Sim, em {settings?.expires_days ?? 60} dias após liberado.</Faq>
            <Faq q="Posso usar meu próprio código?">Não, o código só funciona para outras pessoas.</Faq>
          </div>
        </Section>

        <Section icon={ScrollText} title="Regras & termos" tone="fuchsia">
          <ul className="list-inside list-disc space-y-1 text-sm text-white/70">
            <li>Válido apenas para novos cadastros que ainda não tenham pedido na Quero Bis.</li>
            <li>
              Pedido mínimo do amigo: <b>R$ {settings?.referee_min_order.toFixed(2) ?? "—"}</b>. Pedido mínimo para
              usar seu cupom: <b>R$ {settings?.referrer_min_order.toFixed(2) ?? "—"}</b>.
            </li>
            <li>Cupons não são cumulativos com outras promoções e não geram troco.</li>
            <li>Uso indevido (auto-indicação, contas falsas) cancela recompensas e pode bloquear a conta.</li>
            <li>A loja pode ajustar valores e regras a qualquer momento com aviso prévio no app.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <Icon className={`mb-1 h-5 w-5 ${tone}`} />
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left"
      >
        <span className="text-sm font-semibold text-white">{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-white/10 p-3 text-sm text-white/70">{children}</div>}
    </div>
  );
}
