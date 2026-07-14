import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Cake, Save, Gift, Users, CalendarDays, BellRing, Sparkles,
  Search, Send, CheckCircle2, Clock,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";


export const Route = createFileRoute("/_authenticated/aniversariantes")({
  head: () => ({ meta: [{ title: "Aniversariantes — Admin" }] }),
  component: BirthdayAdmin,
});

type Settings = {
  enabled: boolean;
  discount_type: "fixed" | "percent";
  discount_value: number;
  min_order: number;
  validity_mode: "month" | "days_from_claim";
  validity_days: number;
  per_user_yearly: number;
  banner_emoji: string;
  banner_title: string;
  banner_message: string;
  banner_cta: string;
  push_auto: boolean;
  push_title: string;
  push_body: string;
  notify_days_before: number;
  coupon_prefix: string;
};

type Upcoming = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string;
  days_until: number;
  gift_claimed: boolean;
  gift_code: string | null;
  push_sent: boolean;
};

type HistoryRow = {
  gift_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  year: number;
  coupon_code: string;
  coupon_expires_at: string | null;
  used_at: string | null;
  push_sent_at: string | null;
  granted_by_email: string | null;
  created_at: string;
};

type Stats = {
  total_with_birthday: number;
  this_month: number;
  today: number;
  gifts_claimed_year: number;
  gifts_used_year: number;
  push_sent_year: number;
};

const sb = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-fuchsia-500" : "bg-white/20"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

const selectClass = "w-full h-10 rounded-md bg-white/5 border border-white/15 text-white px-3 text-sm focus:outline-none focus:border-fuchsia-400";

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Cake; label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${tone}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

type Tab = "config" | "stats" | "upcoming" | "history";

function BirthdayAdmin() {
  const [tab, setTab] = useState<Tab>("config");
  const [s, setS] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [range, setRange] = useState(30);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingGift, setSendingGift] = useState<string | null>(null);

  const load = async () => {
    const [cfg, st, up, hi] = await Promise.all([
      sb.rpc("admin_get_birthday_settings"),
      sb.rpc("admin_birthday_stats"),
      sb.rpc("admin_list_upcoming_birthdays", { _days: range }),
      sb.rpc("admin_list_birthday_history", { _limit: 200 }),
    ]);
    if (Array.isArray(cfg.data) && cfg.data.length) setS(cfg.data[0] as Settings);
    if (st.data) setStats(st.data as Stats);
    if (Array.isArray(up.data)) setUpcoming(up.data as Upcoming[]);
    if (Array.isArray(hi.data)) setHistory(hi.data as HistoryRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    (async () => {
      const { data } = await sb.rpc("admin_list_upcoming_birthdays", { _days: range });
      if (Array.isArray(data)) setUpcoming(data as Upcoming[]);
    })();
  }, [range]);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await sb.rpc("admin_update_birthday_settings", { _patch: s as unknown as Record<string, unknown> });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar", { description: error.message });
    toast.success("Configurações salvas");
    load();
  };

  const sendManualGift = async (userId: string) => {
    setSendingGift(userId);
    const { data, error } = await sb.rpc("admin_send_birthday_gift", { _user_id: userId });
    setSendingGift(null);
    if (error) return toast.error("Erro ao enviar cupom de aniversário", { description: error.message });
    const row = Array.isArray(data) ? (data as Array<{ code: string }>)[0] : null;
    toast.success(`Cupom criado: ${row?.code ?? ""}`);
    load();
  };

  const filteredUpcoming = useMemo(() => {
    const term = q.toLowerCase().trim();
    if (!term) return upcoming;
    return upcoming.filter((u) =>
      (u.full_name ?? "").toLowerCase().includes(term) ||
      (u.email ?? "").toLowerCase().includes(term) ||
      (u.phone ?? "").toLowerCase().includes(term)
    );
  }, [q, upcoming]);

  if (loading || !s) {
    return (
      <AdminShell>
        <div className="p-6 text-white/60">Carregando…</div>
      </AdminShell>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Cake }> = [
    { id: "config", label: "Configurações", icon: Sparkles },
    { id: "stats", label: "Estatísticas", icon: BellRing },
    { id: "upcoming", label: "Próximos", icon: CalendarDays },
    { id: "history", label: "Histórico", icon: Gift },
  ];

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-white">
              <Cake className="h-6 w-6 text-neon-pink" /> Aniversariantes
            </h1>
            <p className="mt-0.5 text-sm text-white/60">
              Configure o brinde de aniversário, veja quem faz aniversário em breve e acompanhe uso dos cupons.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm">
            <span className={`h-2 w-2 rounded-full ${s.enabled ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className="text-white/80">{s.enabled ? "Programa ativo" : "Programa desligado"}</span>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                tab === t.id ? "border-fuchsia-400 bg-fuchsia-500/20 text-white" : "border-white/10 bg-white/5 text-white/60 hover:text-white"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </nav>

        {tab === "config" && (
          <div className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Programa</h2>
                  <p className="text-xs text-white/60">Liga/desliga globalmente o brinde de aniversário.</p>
                </div>
                <Toggle checked={s.enabled} onChange={(v) => setS({ ...s, enabled: v })} />
              </div>
            </section>

            <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 md:grid-cols-2">
              <div>
                <h2 className="mb-3 text-lg font-bold text-white">Cupom</h2>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-white/70">Tipo</Label>
                      <select
                        className={selectClass}
                        value={s.discount_type}
                        onChange={(e) => setS({ ...s, discount_type: e.target.value as "fixed" | "percent" })}
                      >
                        <option value="fixed">Valor fixo (R$)</option>
                        <option value="percent">Percentual (%)</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-white/70">Valor</Label>
                      <Input
                        type="number" min={0} step="0.01"
                        value={s.discount_value}
                        onChange={(e) => setS({ ...s, discount_value: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-white/70">Pedido mínimo (R$)</Label>
                    <Input
                      type="number" min={0} step="0.01"
                      value={s.min_order}
                      onChange={(e) => setS({ ...s, min_order: Number(e.target.value) })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-white/70">Prefixo do código</Label>
                      <Input value={s.coupon_prefix} onChange={(e) => setS({ ...s, coupon_prefix: e.target.value.toUpperCase().slice(0, 8) })} />
                    </div>
                    <div>
                      <Label className="text-xs text-white/70">Usos por ano/cliente</Label>
                      <Input
                        type="number" min={1} max={5}
                        value={s.per_user_yearly}
                        onChange={(e) => setS({ ...s, per_user_yearly: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="mb-3 text-lg font-bold text-white">Validade</h2>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-white/70">Modo</Label>
                    <select
                      className={selectClass}
                      value={s.validity_mode}
                      onChange={(e) => setS({ ...s, validity_mode: e.target.value as "month" | "days_from_claim" })}
                    >
                      <option value="month">Até o fim do mês de aniversário</option>
                      <option value="days_from_claim">X dias após resgate</option>
                    </select>
                  </div>
                  {s.validity_mode === "days_from_claim" && (
                    <div>
                      <Label className="text-xs text-white/70">Dias de validade</Label>
                      <Input
                        type="number" min={1} max={365}
                        value={s.validity_days}
                        onChange={(e) => setS({ ...s, validity_days: Number(e.target.value) })}
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-3 text-lg font-bold text-white">Banner no app</h2>
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <Label className="text-xs text-white/70">Emoji</Label>
                  <Input value={s.banner_emoji} onChange={(e) => setS({ ...s, banner_emoji: e.target.value.slice(0, 4) })} />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs text-white/70">Título</Label>
                  <Input value={s.banner_title} onChange={(e) => setS({ ...s, banner_title: e.target.value })} />
                </div>
                <div className="md:col-span-4">
                  <Label className="text-xs text-white/70">Mensagem</Label>
                  <Input value={s.banner_message} onChange={(e) => setS({ ...s, banner_message: e.target.value })} />
                </div>
                <div className="md:col-span-4">
                  <Label className="text-xs text-white/70">Texto do botão</Label>
                  <Input value={s.banner_cta} onChange={(e) => setS({ ...s, banner_cta: e.target.value })} />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Push automático</h2>
                  <p className="text-xs text-white/60">Envio via cron diário para quem faz aniversário no dia.</p>
                </div>
                <Toggle checked={s.push_auto} onChange={(v) => setS({ ...s, push_auto: v })} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-white/70">Título</Label>
                  <Input value={s.push_title} onChange={(e) => setS({ ...s, push_title: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-white/70">Dias de antecedência</Label>
                  <Input
                    type="number" min={0} max={7}
                    value={s.notify_days_before}
                    onChange={(e) => setS({ ...s, notify_days_before: Number(e.target.value) })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-white/70">Mensagem</Label>
                  <Input value={s.push_body} onChange={(e) => setS({ ...s, push_body: e.target.value })} />
                </div>
              </div>
            </section>

            <div className="sticky bottom-4 flex justify-end">
              <Button onClick={save} disabled={saving} className="bg-fuchsia-500 hover:bg-fuchsia-600">
                <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando…" : "Salvar configurações"}
              </Button>
            </div>
          </div>
        )}

        {tab === "stats" && stats && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard icon={Users} label="Com aniversário cadastrado" value={stats.total_with_birthday} tone="" />
            <StatCard icon={CalendarDays} label="Aniversariantes do mês" value={stats.this_month} tone="" />
            <StatCard icon={Cake} label="Hoje" value={stats.today} tone="ring-1 ring-neon-pink/40" />
            <StatCard icon={Gift} label="Brindes emitidos no ano" value={stats.gifts_claimed_year} tone="" />
            <StatCard icon={CheckCircle2} label="Brindes usados no ano" value={stats.gifts_used_year} tone="" />
            <StatCard icon={BellRing} label="Push enviados no ano" value={stats.push_sent_year} tone="" />
          </div>
        )}

        {tab === "upcoming" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2">
                <Search className="h-4 w-4 text-white/40" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nome, email, telefone"
                  className="w-64 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                />
              </div>
              <select className={`${selectClass} w-auto`} value={range} onChange={(e) => setRange(Number(e.target.value))}>
                <option value={7}>Próximos 7 dias</option>
                <option value={15}>Próximos 15 dias</option>
                <option value={30}>Próximos 30 dias</option>
                <option value={60}>Próximos 60 dias</option>
                <option value={365}>Ano todo</option>
              </select>
              <span className="text-xs text-white/50">{filteredUpcoming.length} pessoas</span>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Aniversário</th>
                    <th className="px-3 py-2">Faltam</th>
                    <th className="px-3 py-2">Brinde</th>
                    <th className="px-3 py-2">Push</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUpcoming.map((u) => (
                    <tr key={u.user_id} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium text-white">{u.full_name || "—"}</div>
                        <div className="text-xs text-white/50">{u.email || u.phone || "—"}</div>
                      </td>
                      <td className="px-3 py-2 text-white/80">{new Date(u.birthday).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${u.days_until === 0 ? "bg-neon-pink/25 text-neon-pink" : u.days_until <= 7 ? "bg-amber-500/20 text-amber-200" : "bg-white/10 text-white/60"}`}>
                          {u.days_until === 0 ? "Hoje 🎉" : `${u.days_until}d`}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {u.gift_claimed
                          ? <span className="font-mono text-xs text-neon-yellow">{u.gift_code}</span>
                          : <span className="text-xs text-white/40">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {u.push_sent
                          ? <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Enviado</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-white/40"><Clock className="h-3 w-3" /> —</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sendingGift === u.user_id || u.gift_claimed}
                          onClick={() => sendManualGift(u.user_id)}
                        >
                          <Send className="mr-1 h-3 w-3" />
                          {u.gift_claimed ? "Enviado" : sendingGift === u.user_id ? "Enviando…" : "Enviar brinde"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredUpcoming.length === 0 && (
                    <EmptyState
                      variant="table"
                      colSpan={6}
                      icon={Cake}
                      title={q ? "Nenhum resultado para essa busca" : "Nenhum aniversariante nesse período"}
                      description={
                        q
                          ? "Tente outro termo ou amplie a janela de datas."
                          : "Amplie a janela de datas ou aguarde novos cadastros com data de nascimento."
                      }
                      action={
                        q ? (
                          <Button size="sm" variant="outline" onClick={() => setQ("")}>
                            Limpar busca
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setRange(365)}>
                            Ver o ano todo
                          </Button>
                        )
                      }
                    />
                  )}


                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Cupom</th>
                  <th className="px-3 py-2">Emitido</th>
                  <th className="px-3 py-2">Expira</th>
                  <th className="px-3 py-2">Usado</th>
                  <th className="px-3 py-2">Origem</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.gift_id} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium text-white">{h.full_name || "—"}</div>
                      <div className="text-xs text-white/50">{h.email || "—"}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-neon-yellow">{h.coupon_code}</td>
                    <td className="px-3 py-2 text-xs text-white/70">{new Date(h.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-3 py-2 text-xs text-white/70">{h.coupon_expires_at ? new Date(h.coupon_expires_at).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="px-3 py-2">
                      {h.used_at
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="h-3 w-3" />{new Date(h.used_at).toLocaleDateString("pt-BR")}</span>
                        : <span className="text-xs text-white/40">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-white/60">{h.granted_by_email ? `Manual (${h.granted_by_email})` : "Auto"}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <EmptyState
                    variant="table"
                    colSpan={6}
                    icon={Gift}
                    title="Nenhum brinde emitido ainda"
                    description="Assim que um aniversariante ganhar cupom, ele aparece aqui."
                    size="sm"
                  />
                )}

              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
