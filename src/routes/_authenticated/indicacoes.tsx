import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Gift, Save, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/indicacoes")({
  head: () => ({ meta: [{ title: "Indique um amigo — Admin" }] }),
  component: IndicacoesAdmin,
});

type Settings = {
  enabled: boolean;
  referrer_discount_type: "fixed" | "percent";
  referrer_discount_value: number;
  referrer_min_order: number;
  referee_discount_type: "fixed" | "percent";
  referee_discount_value: number;
  referee_min_order: number;
  expires_days: number;
  require_first_order: boolean;
  max_referrals_per_user: number | null;
  share_message: string;
};

type Row = {
  id: string;
  referrer_email: string | null;
  referrer_name: string | null;
  referee_email: string | null;
  referee_name: string | null;
  code: string;
  status: string;
  created_at: string;
  rewarded_at: string | null;
};

const statusTone: Record<string, string> = {
  signed_up: "bg-blue-500/20 text-blue-200",
  first_order_paid: "bg-amber-500/20 text-amber-200",
  rewarded: "bg-emerald-500/20 text-emerald-200",
  expired: "bg-white/10 text-white/60",
};

const sb = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-fuchsia-500" : "bg-white/20"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const selectClass =
  "w-full h-10 rounded-md bg-white/5 border border-white/15 text-white px-3 text-sm focus:outline-none focus:border-fuchsia-400";

function IndicacoesAdmin() {
  const [s, setS] = useState<Settings | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [cfg, list] = await Promise.all([
      (supabase.from as unknown as (t: string) => { select: (c: string) => { eq: (a: string, b: number) => { maybeSingle: () => Promise<{ data: Settings | null }> } } })(
        "referral_settings",
      )
        .select("*")
        .eq("id", 1)
        .maybeSingle(),
      sb.rpc("admin_list_referrals", { _limit: 200 }),
    ]);
    if (cfg.data) setS(cfg.data as Settings);
    if (list.data) setRows(list.data as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await sb.rpc("admin_update_referral_settings", {
      _payload: {
        enabled: s.enabled,
        referrer_discount_type: s.referrer_discount_type,
        referrer_discount_value: s.referrer_discount_value,
        referrer_min_order: s.referrer_min_order,
        referee_discount_type: s.referee_discount_type,
        referee_discount_value: s.referee_discount_value,
        referee_min_order: s.referee_min_order,
        expires_days: s.expires_days,
        require_first_order: s.require_first_order,
        max_referrals_per_user:
          s.max_referrals_per_user === null || Number.isNaN(s.max_referrals_per_user)
            ? ""
            : String(s.max_referrals_per_user),
        share_message: s.share_message,
      },
    });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    toast.success("Configurações salvas");
  };

  const total = rows.length;
  const rewarded = rows.filter((r) => r.status === "rewarded").length;
  const pending = rows.filter((r) => r.status === "signed_up").length;

  return (
    <AdminShell>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl">
        <header className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
            <Gift className="h-5 w-5 text-fuchsia-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Indique um amigo</h1>
            <p className="text-sm text-white/60">
              Programa de indicação com cupom para quem indica e para o indicado.
            </p>
          </div>
        </header>

        {loading || !s ? (
          <div className="text-white/60">Carregando...</div>
        ) : (
          <>
            <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold">Programa ativo</div>
                  <div className="text-xs text-white/60">
                    Desativado: links de indicação mostram aviso e não geram cupons.
                  </div>
                </div>
                <Toggle checked={s.enabled} onChange={(v) => setS({ ...s, enabled: v })} />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3 rounded-lg border border-white/10 p-4">
                  <div className="text-sm font-semibold text-fuchsia-300">
                    🎁 Cupom do indicado (novo cliente)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-white/70 text-xs">Tipo</Label>
                      <select
                        className={selectClass}
                        value={s.referee_discount_type}
                        onChange={(e) =>
                          setS({
                            ...s,
                            referee_discount_type: e.target.value as "fixed" | "percent",
                          })
                        }
                      >
                        <option value="fixed">Valor fixo (R$)</option>
                        <option value="percent">Porcentagem (%)</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-white/70 text-xs">Valor</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={s.referee_discount_value}
                        onChange={(e) =>
                          setS({ ...s, referee_discount_value: Number(e.target.value) })
                        }
                        className="bg-white/5 border-white/15 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-white/70 text-xs">Pedido mínimo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={s.referee_min_order}
                      onChange={(e) => setS({ ...s, referee_min_order: Number(e.target.value) })}
                      className="bg-white/5 border-white/15 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-white/10 p-4">
                  <div className="text-sm font-semibold text-emerald-300">
                    🏆 Cupom de quem indicou
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-white/70 text-xs">Tipo</Label>
                      <select
                        className={selectClass}
                        value={s.referrer_discount_type}
                        onChange={(e) =>
                          setS({
                            ...s,
                            referrer_discount_type: e.target.value as "fixed" | "percent",
                          })
                        }
                      >
                        <option value="fixed">Valor fixo (R$)</option>
                        <option value="percent">Porcentagem (%)</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-white/70 text-xs">Valor</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={s.referrer_discount_value}
                        onChange={(e) =>
                          setS({ ...s, referrer_discount_value: Number(e.target.value) })
                        }
                        className="bg-white/5 border-white/15 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-white/70 text-xs">Pedido mínimo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={s.referrer_min_order}
                      onChange={(e) =>
                        setS({ ...s, referrer_min_order: Number(e.target.value) })
                      }
                      className="bg-white/5 border-white/15 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-white/70 text-xs">Validade dos cupons (dias)</Label>
                  <Input
                    type="number"
                    value={s.expires_days}
                    onChange={(e) => setS({ ...s, expires_days: Number(e.target.value) })}
                    className="bg-white/5 border-white/15 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white/70 text-xs">Máx. indicações por usuário</Label>
                  <Input
                    type="number"
                    placeholder="Sem limite"
                    value={s.max_referrals_per_user ?? ""}
                    onChange={(e) =>
                      setS({
                        ...s,
                        max_referrals_per_user:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="bg-white/5 border-white/15 text-white"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-white/80 text-sm">
                    <Toggle
                      checked={s.require_first_order}
                      onChange={(v) => setS({ ...s, require_first_order: v })}
                    />
                    Só recompensa novo cliente
                  </label>
                </div>
              </div>

              <div>
                <Label className="text-white/70 text-xs">Mensagem de compartilhamento</Label>
                <textarea
                  value={s.share_message}
                  onChange={(e) => setS({ ...s, share_message: e.target.value })}
                  rows={2}
                  className="w-full rounded-md bg-white/5 border border-white/15 text-white p-3 text-sm focus:outline-none focus:border-fuchsia-400"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={save}
                  disabled={saving}
                  className="bg-fuchsia-500 hover:bg-fuchsia-600 gap-2"
                >
                  <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="text-xs text-white/60">Total de indicações</div>
                <div className="text-2xl font-bold text-white">{total}</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="text-xs text-white/60">Aguardando pedido</div>
                <div className="text-2xl font-bold text-amber-300">{pending}</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="text-xs text-white/60">Recompensadas</div>
                <div className="text-2xl font-bold text-emerald-300">{rewarded}</div>
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center gap-2 mb-3 text-white font-semibold">
                <Users className="h-4 w-4" /> Histórico
              </div>
              {rows.length === 0 ? (
                <div className="text-center py-8 text-white/50">Nenhuma indicação ainda.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-white/50 text-xs uppercase">
                      <tr>
                        <th className="text-left py-2">Data</th>
                        <th className="text-left py-2">Quem indicou</th>
                        <th className="text-left py-2">Indicado</th>
                        <th className="text-left py-2">Código</th>
                        <th className="text-left py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {rows.map((r) => (
                        <tr key={r.id} className="text-white/80">
                          <td className="py-2">
                            {new Date(r.created_at).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="py-2">
                            <div>{r.referrer_name || "—"}</div>
                            <div className="text-xs text-white/50">{r.referrer_email}</div>
                          </td>
                          <td className="py-2">
                            <div>{r.referee_name || "—"}</div>
                            <div className="text-xs text-white/50">{r.referee_email}</div>
                          </td>
                          <td className="py-2 font-mono text-fuchsia-200">{r.code}</td>
                          <td className="py-2">
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                statusTone[r.status] ?? statusTone.signed_up
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
