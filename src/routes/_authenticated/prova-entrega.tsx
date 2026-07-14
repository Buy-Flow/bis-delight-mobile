import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { toast } from "sonner";
import {
  Camera, ShieldCheck, MapPin, Bell, Timer, Percent, Image as ImageIcon,
  AlertTriangle, Save, RefreshCcw, Search, ExternalLink, X, Loader2, Trash2,
  Download, User2, Phone, Hash, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/prova-entrega")({
  head: () => ({
    meta: [{ title: "Prova de entrega — Admin" }],
  }),
  component: ProvaEntregaPage,
});

type Settings = {
  enabled: boolean;
  require_photo: boolean;
  require_signature: boolean;
  require_gps: boolean;
  require_notes: boolean;
  allow_skip: boolean;
  require_skip_reason: boolean;
  allowed_skip_reasons: string[];
  contact_types: string[];
  min_photos: number;
  max_photos: number;
  photo_quality: number;
  max_photo_kb: number;
  watermark: boolean;
  watermark_show_time: boolean;
  watermark_show_order: boolean;
  watermark_show_courier: boolean;
  blur_faces: boolean;
  notify_customer: boolean;
  notify_channels: string[];
  retention_days: number;
  block_completion_without_proof: boolean;
  alert_on_skip: boolean;
};

type Proof = {
  order_id: string;
  order_number: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivered_at: string | null;
  delivery_photo_url: string | null;
  delivery_photo_at: string | null;
  delivery_photo_lat: number | null;
  delivery_photo_lng: number | null;
  delivery_signature_url: string | null;
  delivery_proof_notes: string | null;
  delivery_proof_skipped_reason: string | null;
  delivery_contact_type: string | null;
  total: number | null;
  courier_name: string | null;
};

type Stats = {
  total: number;
  with_photo: number;
  with_signature: number;
  with_gps: number;
  skipped: number;
  compliance_pct: number;
  avg_delay_seconds: number;
};

function ProvaEntregaPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [days, setDays] = useState(30);
  const [q, setQ] = useState("");
  const [onlySkipped, setOnlySkipped] = useState(false);
  const [lightbox, setLightbox] = useState<Proof | null>(null);

  const load = useCallback(async () => {
    setLoadingList(true);
    const [{ data: s }, { data: st }, { data: pr }] = await Promise.all([
      supabase.from("proof_of_delivery_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.rpc("get_proof_of_delivery_stats", { _days: days } as any),
      supabase.rpc("list_delivery_proofs", { _limit: 120, _offset: 0, _only_skipped: onlySkipped } as any),
    ]);
    if (s) setSettings(s as any);
    if (st && !(st as any).error) setStats(st as any);
    const arr = ((pr as any) ?? []) as Proof[];
    setProofs(arr);

    // sign photo urls
    const paths = arr.map((p) => p.delivery_photo_url).filter(Boolean) as string[];
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("delivery-proofs")
        .createSignedUrls(paths, 60 * 60);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s: any, i: number) => {
        if (s.signedUrl) map[paths[i]] = s.signedUrl;
      });
      setSignedUrls(map);
    } else {
      setSignedUrls({});
    }
    setLoadingList(false);
  }, [days, onlySkipped]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("proof_of_delivery_settings")
      .update({ ...settings, updated_at: new Date().toISOString() } as any)
      .eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Configurações salvas");
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return proofs;
    return proofs.filter((p) =>
      [p.customer_name, p.customer_phone, String(p.order_number ?? ""), p.courier_name]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(needle))
    );
  }, [proofs, q]);

  const deletePhoto = async (p: Proof) => {
    if (!p.delivery_photo_url) return;
    if (!(await confirmDialog({ message: `Remover a foto do pedido #${p.order_number}?` }))) return;
    const { error: e1 } = await supabase.storage
      .from("delivery-proofs")
      .remove([p.delivery_photo_url]);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase
      .from("orders")
      .update({ delivery_photo_url: null } as any)
      .eq("id", p.order_id);
    if (e2) return toast.error(e2.message);
    toast.success("Foto removida");
    load();
  };

  return (
    <AdminShell>
      <div className="min-h-screen bg-background p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-fuchsia-300">
                <Camera className="h-3.5 w-3.5" /> Prova de entrega
              </div>
              <h1 className="text-2xl font-black text-white mt-1">
                Foto obrigatória, chargeback controlado.
              </h1>
              <p className="text-sm text-white/60 max-w-2xl mt-1">
                Cada entrega concluída pelo motoboy pode exigir uma foto na porta com marca d'água,
                GPS e observação. Você define o rigor abaixo e revisa tudo na galeria.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 90 dias</option>
              </select>
              <button
                onClick={load}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Kpi
              label="Entregas"
              value={stats?.total ?? 0}
              icon={ShieldCheck}
              tone="cyan"
            />
            <Kpi
              label="Com foto"
              value={stats?.with_photo ?? 0}
              icon={Camera}
              tone="emerald"
            />
            <Kpi
              label="Compliance"
              value={`${stats?.compliance_pct ?? 0}%`}
              icon={Percent}
              tone={stats && stats.compliance_pct >= 90 ? "emerald" : stats && stats.compliance_pct >= 70 ? "amber" : "red"}
            />
            <Kpi
              label="Com GPS"
              value={stats?.with_gps ?? 0}
              icon={MapPin}
              tone="fuchsia"
            />
            <Kpi
              label="Puladas"
              value={stats?.skipped ?? 0}
              icon={AlertTriangle}
              tone={stats && stats.skipped > 5 ? "amber" : "white"}
            />
            <Kpi
              label="Atraso médio"
              value={stats?.avg_delay_seconds ? `${Math.round(stats.avg_delay_seconds)}s` : "0s"}
              icon={Timer}
              tone="white"
            />
          </div>

          {/* Settings */}
          {settings && (
            <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-4 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-fuchsia-400" /> Regras do sistema
                </h2>
                <div className="flex items-center gap-2">
                  <MasterSwitch
                    checked={settings.enabled}
                    onChange={(v) => setSettings({ ...settings, enabled: v })}
                  />
                  <button
                    onClick={save}
                    disabled={saving}
                    className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-black text-white shadow disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1 inline h-4 w-4" /> Salvar</>}
                  </button>
                </div>
              </div>

              <div className={cn("grid gap-6 lg:grid-cols-2", !settings.enabled && "opacity-50 pointer-events-none")}>
                {/* Requirements */}
                <Section title="Obrigatoriedade">
                  <Toggle label="Exigir foto na conclusão" hint="Motoboy só finaliza tirando a foto." checked={settings.require_photo} onChange={(v) => setSettings({ ...settings, require_photo: v })} />
                  <Toggle label="Bloquear entrega sem prova" hint="Se desligado, o motoboy pode concluir sem foto." checked={settings.block_completion_without_proof} onChange={(v) => setSettings({ ...settings, block_completion_without_proof: v })} />
                  <Toggle label="Registrar GPS" hint="Coordenadas do local no momento da foto." checked={settings.require_gps} onChange={(v) => setSettings({ ...settings, require_gps: v })} />
                  <Toggle label="Assinatura do cliente" hint="Pede assinatura na tela quando disponível." checked={settings.require_signature} onChange={(v) => setSettings({ ...settings, require_signature: v })} />
                  <Toggle label="Observação obrigatória" checked={settings.require_notes} onChange={(v) => setSettings({ ...settings, require_notes: v })} />
                  <Toggle label="Permitir pular a foto" hint="Se sim, permite finalizar sem foto informando motivo." checked={settings.allow_skip} onChange={(v) => setSettings({ ...settings, allow_skip: v })} />
                  <Toggle label="Motivo obrigatório ao pular" checked={settings.require_skip_reason} onChange={(v) => setSettings({ ...settings, require_skip_reason: v })} />
                  <Toggle label="Alertar admin quando pular" checked={settings.alert_on_skip} onChange={(v) => setSettings({ ...settings, alert_on_skip: v })} />
                </Section>

                {/* Photo tuning */}
                <Section title="Qualidade e marca d'água">
                  <NumField label="Qualidade JPG" hint="30% comprime muito • 100% arquivo grande" value={Math.round(settings.photo_quality * 100)} min={30} max={100} onChange={(v) => setSettings({ ...settings, photo_quality: v / 100 })} suffix="%" />
                  <NumField label="Tamanho alvo por foto" value={settings.max_photo_kb} min={100} max={3000} onChange={(v) => setSettings({ ...settings, max_photo_kb: v })} suffix="KB" />
                  <NumField label="Fotos por entrega (mínimo)" value={settings.min_photos} min={1} max={5} onChange={(v) => setSettings({ ...settings, min_photos: v })} />
                  <NumField label="Fotos por entrega (máximo)" value={settings.max_photos} min={settings.min_photos} max={5} onChange={(v) => setSettings({ ...settings, max_photos: v })} />
                  <Toggle label="Aplicar marca d'água" hint="Sobrepõe pedido, motoboy e hora na foto." checked={settings.watermark} onChange={(v) => setSettings({ ...settings, watermark: v })} />
                  <Toggle label="Mostrar número do pedido" checked={settings.watermark_show_order} onChange={(v) => setSettings({ ...settings, watermark_show_order: v })} />
                  <Toggle label="Mostrar nome do motoboy" checked={settings.watermark_show_courier} onChange={(v) => setSettings({ ...settings, watermark_show_courier: v })} />
                  <Toggle label="Mostrar data/hora" checked={settings.watermark_show_time} onChange={(v) => setSettings({ ...settings, watermark_show_time: v })} />
                  <Toggle label="Borrar rostos (privacidade)" hint="Reservado para versão futura com IA." checked={settings.blur_faces} onChange={(v) => setSettings({ ...settings, blur_faces: v })} />
                </Section>

                <Section title="Notificações & retenção">
                  <Toggle label="Notificar cliente com a foto" hint="Envia push e mostra na página de rastreio." checked={settings.notify_customer} onChange={(v) => setSettings({ ...settings, notify_customer: v })} />
                  <ChipList
                    label="Canais de notificação"
                    options={["push", "tracking", "whatsapp", "email"]}
                    value={settings.notify_channels}
                    onChange={(v) => setSettings({ ...settings, notify_channels: v })}
                  />
                  <NumField
                    label="Retenção da foto"
                    hint="Depois desse prazo a foto é apagada automaticamente."
                    value={settings.retention_days}
                    min={7} max={365}
                    onChange={(v) => setSettings({ ...settings, retention_days: v })}
                    suffix="dias"
                  />
                </Section>

                <Section title="Motivos & tipo de entrega">
                  <ListEditor
                    label="Motivos aceitos para pular"
                    hint="Motoboy escolhe um destes se não conseguir tirar foto."
                    value={settings.allowed_skip_reasons}
                    onChange={(v) => setSettings({ ...settings, allowed_skip_reasons: v })}
                  />
                  <ChipList
                    label="Tipos de contato aceitos"
                    options={["entregue_mao", "portaria", "vizinho", "porta", "sem_contato"]}
                    value={settings.contact_types}
                    onChange={(v) => setSettings({ ...settings, contact_types: v })}
                  />
                </Section>
              </div>
            </section>
          )}

          {/* Gallery */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-fuchsia-400" /> Galeria de entregas
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Pedido, cliente ou motoboy..."
                    className="rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 w-56"
                  />
                </div>
                <button
                  onClick={() => setOnlySkipped((v) => !v)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs font-bold",
                    onlySkipped ? "border-amber-400 bg-amber-500/15 text-amber-100" : "border-white/10 bg-white/5 text-white/70",
                  )}
                >
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> Só puladas
                </button>
              </div>
            </div>

            {loadingList ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" /></div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-sm text-white/50">
                Nenhuma entrega encontrada para o filtro atual.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p) => {
                  const url = p.delivery_photo_url ? signedUrls[p.delivery_photo_url] : null;
                  return (
                    <div key={p.order_id} className="group rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                      <button
                        onClick={() => setLightbox(p)}
                        className="relative block aspect-square w-full bg-black/40"
                      >
                        {url ? (
                          <img src={url} alt={`Pedido ${p.order_number}`} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                        ) : (
                          <div className="grid h-full place-items-center text-center p-4">
                            <div>
                              <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
                              <div className="mt-2 text-[10px] font-bold uppercase text-amber-300">Sem foto</div>
                              {p.delivery_proof_skipped_reason && (
                                <div className="mt-1 text-[11px] text-white/60">{p.delivery_proof_skipped_reason}</div>
                              )}
                            </div>
                          </div>
                        )}
                        {p.delivery_contact_type && (
                          <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white">
                            {contactLabel(p.delivery_contact_type)}
                          </span>
                        )}
                        {p.delivery_photo_lat && (
                          <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-emerald-300">
                            <MapPin className="mr-0.5 inline h-2.5 w-2.5" /> GPS
                          </span>
                        )}
                      </button>
                      <div className="p-3">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-black text-white">#{p.order_number ?? "—"}</span>
                          <span className="text-white/50">{fmtDate(p.delivered_at)}</span>
                        </div>
                        <div className="mt-0.5 truncate text-sm font-bold text-white/90">{p.customer_name ?? "—"}</div>
                        <div className="text-[11px] text-white/50 truncate">🏍 {p.courier_name ?? "—"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {lightbox && (
        <Lightbox
          proof={lightbox}
          url={lightbox.delivery_photo_url ? signedUrls[lightbox.delivery_photo_url] : null}
          onClose={() => setLightbox(null)}
          onDelete={() => { deletePhoto(lightbox); setLightbox(null); }}
        />
      )}
    </AdminShell>
  );
}

/* ---------------- helpers ---------------- */

function contactLabel(k: string) {
  const map: Record<string, string> = {
    entregue_mao: "Em mãos",
    portaria: "Portaria",
    vizinho: "Vizinho",
    porta: "Na porta",
    sem_contato: "Sem contato",
  };
  return map[k] ?? k;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Kpi({
  label, value, icon: Icon, tone,
}: { label: string; value: number | string; icon: any; tone: "cyan" | "emerald" | "amber" | "red" | "fuchsia" | "white" }) {
  const toneCls = {
    cyan: "text-cyan-300 bg-cyan-500/10",
    emerald: "text-emerald-300 bg-emerald-500/10",
    amber: "text-amber-300 bg-amber-500/10",
    red: "text-red-300 bg-red-500/10",
    fuchsia: "text-fuchsia-300 bg-fuchsia-500/10",
    white: "text-white bg-white/10",
  }[tone];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg", toneCls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-[10px] font-bold uppercase text-white/50">{label}</div>
      <div className="text-lg font-black text-white">{value}</div>
    </div>
  );
}

function MasterSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold",
        checked ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60",
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", checked ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.7)]" : "bg-white/40")} />
      {checked ? "Sistema ativo" : "Sistema desativado"}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-fuchsia-300">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Toggle({
  label, hint, checked, onChange,
}: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-white">{label}</div>
        {hint && <div className="text-[11px] text-white/50">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-1 h-6 w-11 shrink-0 rounded-full transition-all",
          checked ? "bg-gradient-to-r from-fuchsia-500 to-pink-500" : "bg-white/10",
        )}
      >
        <span className={cn("block h-5 w-5 rounded-full bg-white transition-all", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

function NumField({
  label, hint, value, min, max, onChange, suffix,
}: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-white">{label}</div>
          {hint && <div className="text-[11px] text-white/50">{hint}</div>}
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-1 text-sm font-black text-white">
          {value}{suffix ? ` ${suffix}` : ""}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-fuchsia-500"
      />
    </div>
  );
}

function ChipList({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <div className="text-sm font-bold text-white">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button
              key={opt}
              onClick={() =>
                onChange(active ? value.filter((v) => v !== opt) : [...value, opt])
              }
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold",
                active ? "bg-fuchsia-500 text-white" : "bg-white/5 text-white/60 hover:bg-white/10",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListEditor({
  label, hint, value, onChange,
}: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <div className="text-sm font-bold text-white">{label}</div>
      {hint && <div className="text-[11px] text-white/50">{hint}</div>}
      <div className="mt-2 space-y-1.5">
        {value.map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-sm text-white">
            <span className="flex-1">{r}</span>
            <button
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="text-white/40 hover:text-red-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onChange([...value, draft.trim()]);
              setDraft("");
            }
          }}
          placeholder="Adicionar motivo e Enter"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-white/30"
        />
        <button
          onClick={() => { if (draft.trim()) { onChange([...value, draft.trim()]); setDraft(""); } }}
          className="rounded-lg bg-fuchsia-500 px-3 text-xs font-bold text-white"
        >
          +
        </button>
      </div>
    </div>
  );
}

function Lightbox({
  proof, url, onClose, onDelete,
}: { proof: Proof; url: string | null; onClose: () => void; onDelete: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 p-4 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-white">
          <div className="text-xs font-bold uppercase text-fuchsia-300">Pedido #{proof.order_number}</div>
          <div className="text-lg font-black">{proof.customer_name ?? "—"}</div>
        </div>
        <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-white"><X className="h-5 w-5" /></button>
      </div>

      <div className="mx-auto grid max-w-6xl flex-1 w-full gap-4 lg:grid-cols-[1fr,320px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-2xl bg-black/60 flex items-center justify-center overflow-hidden">
          {url ? (
            <img src={url} alt="Prova" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="text-center text-white/60 p-8">
              <AlertTriangle className="mx-auto h-12 w-12 text-amber-400 mb-3" />
              <div className="font-bold">Sem foto</div>
              {proof.delivery_proof_skipped_reason && (
                <div className="mt-2 text-sm">{proof.delivery_proof_skipped_reason}</div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-3 text-sm">
          <InfoRow icon={Calendar} label="Entregue em" value={fmtDate(proof.delivered_at)} />
          <InfoRow icon={Hash} label="Pedido" value={`#${proof.order_number ?? "—"} • R$ ${(proof.total ?? 0).toFixed(2)}`} />
          <InfoRow icon={User2} label="Cliente" value={proof.customer_name ?? "—"} />
          <InfoRow icon={Phone} label="Telefone" value={proof.customer_phone ?? "—"} />
          <InfoRow icon={Camera} label="Motoboy" value={proof.courier_name ?? "—"} />
          <InfoRow icon={MapPin} label="Tipo de contato" value={proof.delivery_contact_type ? contactLabel(proof.delivery_contact_type) : "—"} />
          {proof.delivery_photo_lat && proof.delivery_photo_lng && (
            <a
              href={`https://www.google.com/maps?q=${proof.delivery_photo_lat},${proof.delivery_photo_lng}`}
              target="_blank" rel="noreferrer"
              className="flex items-center justify-between rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-emerald-100"
            >
              <span className="text-xs font-bold">Ver GPS no mapa</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {proof.delivery_proof_notes && (
            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-[11px] font-bold uppercase text-white/50 mb-1">Observação</div>
              <div className="text-sm text-white/90">{proof.delivery_proof_notes}</div>
            </div>
          )}
          <div className="flex gap-2">
            {url && (
              <a
                href={url}
                download={`entrega-${proof.order_number}.jpg`}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-center text-xs font-bold text-white"
              >
                <Download className="mr-1 inline h-3.5 w-3.5" /> Baixar
              </a>
            )}
            <button
              onClick={onDelete}
              className="rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs font-bold text-red-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-white/5 p-3">
      <Icon className="h-4 w-4 text-fuchsia-400 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase text-white/50">{label}</div>
        <div className="text-sm text-white truncate">{value}</div>
      </div>
    </div>
  );
}
