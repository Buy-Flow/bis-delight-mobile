import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Trophy, Save, Plus, Trash2, GripVertical, Crown, Sparkles, Settings2, ListOrdered, RefreshCw, Eye, EyeOff,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ranking-vip")({
  head: () => ({ meta: [{ title: "Ranking VIP — Admin" }, { name: "robots", content: "noindex" }] }),
  component: RankingVipPage,
});

type Tier = {
  key: string;
  name: string;
  emoji?: string;
  color?: string;
  min_ltv?: number;
  min_orders?: number;
  perks?: string;
};

type Settings = {
  id?: string;
  enabled: boolean;
  show_percentile: boolean;
  show_rank: boolean;
  show_leaderboard: boolean;
  leaderboard_size: number;
  mask_leaderboard_names: boolean;
  top_badge_percent: number;
  min_orders_to_rank: number;
  metric: "ltv" | "orders" | "hybrid";
  tiers: Tier[];
  hero_title: string;
  hero_subtitle: string;
};

type LbRow = {
  rank_pos: number;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ltv: number;
  orders_ct: number;
  last_order: string | null;
  tier_key: string | null;
};

const BRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));

function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${checked ? "bg-amber-500" : "bg-white/10"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function RankingVipPage() {
  const [tab, setTab] = useState<"config" | "tiers" | "leaderboard" | "preview">("config");
  const [s, setS] = useState<Settings | null>(null);
  const [lb, setLb] = useState<LbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cfg }, { data: rows }] = await Promise.all([
      supabase.from("vip_ranking_settings").select("*").eq("singleton", true).maybeSingle(),
      supabase.rpc("get_vip_leaderboard_admin", { _limit: 100 }),
    ]);
    if (cfg) {
      setS({
        ...cfg,
        tiers: (cfg.tiers as Tier[]) ?? [],
      } as Settings);
    }
    setLb((rows as LbRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase
      .from("vip_ranking_settings")
      .update({
        enabled: s.enabled,
        show_percentile: s.show_percentile,
        show_rank: s.show_rank,
        show_leaderboard: s.show_leaderboard,
        leaderboard_size: s.leaderboard_size,
        mask_leaderboard_names: s.mask_leaderboard_names,
        top_badge_percent: s.top_badge_percent,
        min_orders_to_rank: s.min_orders_to_rank,
        metric: s.metric,
        tiers: s.tiers,
        hero_title: s.hero_title,
        hero_subtitle: s.hero_subtitle,
        updated_at: new Date().toISOString(),
      })
      .eq("singleton", true);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configurações salvas");
    }
  };

  const totals = useMemo(() => {
    const total = lb.length;
    const revenue = lb.reduce((a, r) => a + Number(r.ltv || 0), 0);
    const top = s ? Math.max(1, Math.round((total * s.top_badge_percent) / 100)) : 0;
    return { total, revenue, top };
  }, [lb, s]);

  if (loading || !s) {
    return (
      <AdminShell>
        <div className="mx-auto max-w-6xl p-6">
          <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/15 text-amber-300">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">Ranking VIP</h1>
              <p className="text-sm text-white/60">Gamificação do perfil do cliente — status vende.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={load} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2 bg-amber-500 hover:bg-amber-600">
              <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi icon={ListOrdered} label="Clientes ranqueados" value={String(totals.total)} tint="amber" />
          <Kpi icon={Crown} label={`Top ${s.top_badge_percent}% (elite)`} value={String(totals.top)} tint="yellow" />
          <Kpi icon={Sparkles} label="LTV combinado" value={BRL(totals.revenue)} tint="rose" />
          <Kpi icon={Trophy} label="Níveis ativos" value={String(s.tiers.length)} tint="violet" />
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(["config", "tiers", "leaderboard", "preview"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tab === t ? "bg-amber-500 text-white" : "text-white/70 hover:bg-slate-50"
              }`}
            >
              {t === "config" && "Configuração"}
              {t === "tiers" && "Níveis"}
              {t === "leaderboard" && "Leaderboard"}
              {t === "preview" && "Prévia"}
            </button>
          ))}
        </div>

        {tab === "config" && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Visibilidade & mensagens" icon={Eye}>
              <Row label="Ranking VIP ativo">
                <Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} />
              </Row>
              <Row label="Mostrar percentil (Top X%)">
                <Switch checked={s.show_percentile} onCheckedChange={(v) => setS({ ...s, show_percentile: v })} />
              </Row>
              <Row label="Mostrar posição (#12)">
                <Switch checked={s.show_rank} onCheckedChange={(v) => setS({ ...s, show_rank: v })} />
              </Row>
              <Row label="Mostrar leaderboard público">
                <Switch checked={s.show_leaderboard} onCheckedChange={(v) => setS({ ...s, show_leaderboard: v })} />
              </Row>
              <Row label="Anonimizar nomes no leaderboard">
                <Switch checked={s.mask_leaderboard_names} onCheckedChange={(v) => setS({ ...s, mask_leaderboard_names: v })} />
              </Row>
              <div className="space-y-2 pt-2">
                <Label>Título do card (cliente)</Label>
                <Input value={s.hero_title} onChange={(e) => setS({ ...s, hero_title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Subtítulo motivacional</Label>
                <Input value={s.hero_subtitle} onChange={(e) => setS({ ...s, hero_subtitle: e.target.value })} />
              </div>
            </Card>

            <Card title="Regras do ranking" icon={Settings2}>
              <div className="space-y-2">
                <Label>Métrica principal</Label>
                <div className="flex gap-2">
                  {(["ltv", "orders", "hybrid"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setS({ ...s, metric: m })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        s.metric === m ? "border-amber-400 bg-amber-500/15 text-amber-200" : "border-slate-200 text-white/70"
                      }`}
                    >
                      {m === "ltv" && "LTV (R$)"}
                      {m === "orders" && "Pedidos"}
                      {m === "hybrid" && "Híbrido"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/60">
                  <strong>LTV</strong>: quanto mais gasta, melhor.{" "}
                  <strong>Pedidos</strong>: frequência acima de tudo.{" "}
                  <strong>Híbrido</strong>: 70% LTV + 30% frequência.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Mín. pedidos p/ ranquear</Label>
                  <Input
                    type="number" min={1}
                    value={s.min_orders_to_rank}
                    onChange={(e) => setS({ ...s, min_orders_to_rank: parseInt(e.target.value || "1") })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>"Top X%" badge (%)</Label>
                  <Input
                    type="number" min={1} max={50}
                    value={s.top_badge_percent}
                    onChange={(e) => setS({ ...s, top_badge_percent: parseInt(e.target.value || "5") })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tamanho do leaderboard</Label>
                <Input
                  type="number" min={3} max={100}
                  value={s.leaderboard_size}
                  onChange={(e) => setS({ ...s, leaderboard_size: parseInt(e.target.value || "10") })}
                />
              </div>
            </Card>
          </div>
        )}

        {tab === "tiers" && (
          <TiersEditor tiers={s.tiers} onChange={(tiers) => setS({ ...s, tiers })} />
        )}

        {tab === "leaderboard" && (
          <LeaderboardTable rows={lb} tiers={s.tiers} />
        )}

        {tab === "preview" && <PreviewCustomer settings={s} rows={lb.slice(0, s.leaderboard_size)} />}
      </div>
    </AdminShell>
  );
}

function Kpi({ icon: Icon, label, value, tint }: { icon: any; label: string; value: string; tint: string }) {
  const map: Record<string, string> = {
    amber: "bg-amber-500/15 text-amber-300",
    yellow: "bg-yellow-500/15 text-yellow-300",
    rose: "bg-rose-500/15 text-rose-300",
    violet: "bg-violet-500/15 text-violet-300",
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${map[tint]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-xl font-black text-white">{value}</div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white/60">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
      <div className="text-sm text-white/80">{label}</div>
      {children}
    </div>
  );
}

function TiersEditor({ tiers, onChange }: { tiers: Tier[]; onChange: (t: Tier[]) => void }) {
  const update = (i: number, patch: Partial<Tier>) => {
    const next = tiers.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(tiers.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tiers.length) return;
    const next = tiers.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () =>
    onChange([
      ...tiers,
      { key: `nivel_${tiers.length + 1}`, name: "Novo nível", emoji: "⭐", color: "#a78bfa", min_ltv: 0, min_orders: 0, perks: "" },
    ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/70">
          Ordene do menor para o maior. O sistema atribui ao cliente o nível mais alto cujos requisitos ele já atingiu.
        </p>
        <Button onClick={add} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" /> Novo nível
        </Button>
      </div>
      <div className="space-y-3">
        {tiers.map((t, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="grid gap-3 md:grid-cols-[auto_1fr_1fr_1fr_1fr_auto]">
              <div className="flex flex-col justify-center gap-1">
                <button onClick={() => move(i, -1)} className="rounded p-1 text-white/40 hover:bg-white/5" disabled={i === 0}>
                  <GripVertical className="h-4 w-4 rotate-90" />
                </button>
                <div className="text-center text-[10px] font-bold text-white/40">#{i + 1}</div>
                <button onClick={() => move(i, 1)} className="rounded p-1 text-white/40 hover:bg-white/5" disabled={i === tiers.length - 1}>
                  <GripVertical className="h-4 w-4 rotate-90" />
                </button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={t.name} onChange={(e) => update(i, { name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Emoji</Label>
                <Input value={t.emoji ?? ""} onChange={(e) => update(i, { emoji: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mín. LTV (R$)</Label>
                <Input type="number" min={0} value={t.min_ltv ?? 0} onChange={(e) => update(i, { min_ltv: parseFloat(e.target.value || "0") })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mín. pedidos</Label>
                <Input type="number" min={0} value={t.min_orders ?? 0} onChange={(e) => update(i, { min_orders: parseInt(e.target.value || "0") })} />
              </div>
              <div className="flex items-start justify-end pt-6">
                <button onClick={() => remove(i)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10" title="Remover">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr]">
              <div className="space-y-1">
                <Label className="text-xs">Cor (hex)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={t.color ?? "#facc15"}
                    onChange={(e) => update(i, { color: e.target.value })}
                    className="h-9 w-14 cursor-pointer rounded border border-white/10"
                  />
                  <Input value={t.color ?? ""} onChange={(e) => update(i, { color: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Benefícios exibidos ao cliente</Label>
                <Input
                  value={t.perks ?? ""}
                  placeholder="Ex.: Frete grátis + brinde mensal"
                  onChange={(e) => update(i, { perks: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardTable({ rows, tiers }: { rows: LbRow[]; tiers: Tier[] }) {
  const tierMap = new Map(tiers.map((t) => [t.key, t]));
  if (!rows.length)
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-white/60">
        Nenhum cliente ranqueado ainda.
      </div>
    );
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-widest text-white/60">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Nível</th>
            <th className="px-4 py-3 text-right">LTV</th>
            <th className="px-4 py-3 text-right">Pedidos</th>
            <th className="px-4 py-3">Contato</th>
            <th className="px-4 py-3">Último pedido</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const t = r.tier_key ? tierMap.get(r.tier_key) : null;
            return (
              <tr key={r.user_id} className="border-t border-white/5 hover:bg-white/[0.04]">
                <td className="px-4 py-3 font-mono text-xs font-black text-white/60">
                  {r.rank_pos === 1 && "🥇"} {r.rank_pos === 2 && "🥈"} {r.rank_pos === 3 && "🥉"} #{r.rank_pos}
                </td>
                <td className="px-4 py-3 font-medium text-white">{r.name || "—"}</td>
                <td className="px-4 py-3">
                  {t ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: `${t.color}22`, color: t.color }}
                    >
                      {t.emoji} {t.name}
                    </span>
                  ) : (
                    <span className="text-xs text-white/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono">{BRL(Number(r.ltv))}</td>
                <td className="px-4 py-3 text-right font-mono">{r.orders_ct}</td>
                <td className="px-4 py-3 text-xs text-white/60">
                  {r.phone || r.email || "—"}
                </td>
                <td className="px-4 py-3 text-xs text-white/60">
                  {r.last_order ? new Date(r.last_order).toLocaleDateString("pt-BR") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PreviewCustomer({ settings, rows }: { settings: Settings; rows: LbRow[] }) {
  const first = rows[0];
  const topTier = [...settings.tiers].reverse().find((t) =>
    first ? Number(first.ltv) >= Number(t.min_ltv ?? 0) && Number(first.orders_ct) >= Number(t.min_orders ?? 0) : false,
  ) ?? settings.tiers[settings.tiers.length - 1];
  const tierColor = topTier?.color ?? "#facc15";
  return (
    <div className="mx-auto max-w-md">
      <p className="mb-3 text-center text-xs uppercase tracking-widest text-white/60">
        Prévia exibida ao cliente (perfil → Fidelidade)
      </p>
      <div className="rounded-3xl bg-[oklch(0.18_0.11_305)] p-5 shadow-2xl">
        <div
          className="relative overflow-hidden rounded-3xl border p-5"
          style={{
            borderColor: `${tierColor}55`,
            background: `linear-gradient(135deg, ${tierColor}22, oklch(0.15 0.08 305 / 0.9), ${tierColor}11)`,
          }}
        >
          <div className="absolute -right-6 top-3 rotate-12 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
            style={{ borderColor: tierColor, color: tierColor }}>
            <Crown className="mr-1 inline h-3 w-3" /> Top {settings.top_badge_percent}%
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5" style={{ color: tierColor }} />
            <div className="font-black uppercase tracking-wide text-white">{settings.hero_title}</div>
          </div>
          <div className="mt-1 text-[11px] text-white/70">{settings.hero_subtitle}</div>
          <div className="mt-4 flex items-end gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl text-3xl"
              style={{ background: `${tierColor}22`, border: `1px solid ${tierColor}66` }}>
              {topTier?.emoji ?? "🏆"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-white/50">Seu nível</div>
              <div className="text-2xl font-black text-white">{topTier?.name ?? "—"}</div>
              {topTier?.perks && <div className="text-[11px] text-white/70">🎁 {topTier.perks}</div>}
            </div>
          </div>
        </div>
        {settings.show_leaderboard && rows.length > 0 && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-white">Ranking geral</div>
            <div className="space-y-1">
              {rows.slice(0, 5).map((r) => (
                <div key={r.user_id} className="flex items-center justify-between text-xs text-white/80">
                  <span>
                    #{r.rank_pos}{" "}
                    {settings.mask_leaderboard_names
                      ? (r.name ? r.name[0] + "•••" + r.name.slice(-1) : "Cliente")
                      : r.name}
                  </span>
                  <span className="font-mono">{BRL(Number(r.ltv))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
