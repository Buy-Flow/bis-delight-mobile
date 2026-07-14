import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAlerts,
  fetchGlobal,
  playAlert,
  primeSoundContext,
  type SoundAlert,
  type SoundGlobalSettings,
} from "@/lib/sound-alerts";
import {
  Volume2,
  VolumeX,
  Play,
  Save,
  Moon,
  Timer,
  Bell,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Truck,
  PackageCheck,
  PackageX,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alertas-sonoros")({
  head: () => ({
    meta: [
      { title: "Alertas sonoros — Painel" },
      { name: "description", content: "Configure sons diferentes para cada tipo de evento." },
    ],
  }),
  component: AlertasSonorosPage,
});

const PRESETS: Record<string, { waveform: SoundAlert["waveform"]; frequency: number; duration_ms: number; repeats: number; interval_ms: number }> = {
  beep: { waveform: "sine", frequency: 880, duration_ms: 200, repeats: 2, interval_ms: 150 },
  chime: { waveform: "sine", frequency: 1046, duration_ms: 260, repeats: 3, interval_ms: 150 },
  ding: { waveform: "triangle", frequency: 1568, duration_ms: 180, repeats: 2, interval_ms: 120 },
  alarm: { waveform: "square", frequency: 440, duration_ms: 320, repeats: 4, interval_ms: 200 },
  buzz: { waveform: "sawtooth", frequency: 220, duration_ms: 500, repeats: 2, interval_ms: 220 },
  klaxon: { waveform: "square", frequency: 330, duration_ms: 260, repeats: 3, interval_ms: 140 },
  custom: { waveform: "sine", frequency: 880, duration_ms: 220, repeats: 2, interval_ms: 180 },
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  new_order: Bell,
  paid_order: CheckCircle2,
  late_order: AlertTriangle,
  cancelled_order: XCircle,
  dispatched_order: Truck,
  delivered_order: PackageCheck,
  low_stock: PackageX,
  new_review: Star,
};

const ACCENT: Record<string, string> = {
  new_order: "from-emerald-500/30 to-emerald-500/5 text-emerald-200",
  paid_order: "from-sky-500/30 to-sky-500/5 text-sky-200",
  late_order: "from-amber-500/30 to-amber-500/5 text-amber-200",
  cancelled_order: "from-red-500/30 to-red-500/5 text-red-200",
  dispatched_order: "from-indigo-500/30 to-indigo-500/5 text-indigo-200",
  delivered_order: "from-teal-500/30 to-teal-500/5 text-teal-200",
  low_stock: "from-orange-500/30 to-orange-500/5 text-orange-200",
  new_review: "from-fuchsia-500/30 to-fuchsia-500/5 text-fuchsia-200",
};

function AlertasSonorosPage() {
  const [alerts, setAlerts] = useState<SoundAlert[]>([]);
  const [global, setGlobal] = useState<SoundGlobalSettings | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [g, a] = await Promise.all([fetchGlobal(), fetchAlerts()]);
    setGlobal(g);
    setAlerts(a);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const updateAlert = (key: string, patch: Partial<SoundAlert>) => {
    setAlerts((prev) => prev.map((a) => (a.event_key === key ? { ...a, ...patch } : a)));
  };

  const saveAlert = async (a: SoundAlert) => {
    setSaving(a.event_key);
    const { error } = await supabase
      .from("sound_alerts" as never)
      .update({
        enabled: a.enabled,
        preset: a.preset,
        waveform: a.waveform,
        frequency: a.frequency,
        duration_ms: a.duration_ms,
        repeats: a.repeats,
        interval_ms: a.interval_ms,
        volume: a.volume,
        custom_url: a.custom_url || null,
        speak_enabled: a.speak_enabled,
        speak_text: a.speak_text || null,
      } as never)
      .eq("event_key" as never, a.event_key);
    setSaving(null);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else toast.success(`Alerta "${a.label}" salvo`);
  };

  const saveGlobal = async () => {
    if (!global) return;
    setSaving("__global__");
    const { error } = await supabase
      .from("sound_alert_settings" as never)
      .update({
        enabled: global.enabled,
        master_volume: global.master_volume,
        quiet_hours_enabled: global.quiet_hours_enabled,
        quiet_start: global.quiet_start,
        quiet_end: global.quiet_end,
        late_after_minutes: global.late_after_minutes,
      } as never)
      .eq("id" as never, 1);
    setSaving(null);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else toast.success("Configuração global salva");
  };

  const testAlert = async (a: SoundAlert) => {
    if (!global) return;
    await primeSoundContext();
    await playAlert(a, { ...global, enabled: true }, { ignoreEnabled: true, ignoreQuietHours: true });
  };

  const applyPreset = (key: string, preset: string) => {
    const cfg = PRESETS[preset];
    if (!cfg) return updateAlert(key, { preset });
    updateAlert(key, { preset, ...cfg });
  };

  const totalEnabled = useMemo(() => alerts.filter((a) => a.enabled).length, [alerts]);

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-black text-white md:text-3xl">Alertas sonoros</h1>
          <p className="text-sm text-white/60">
            Toque um som diferente para cada tipo de evento. Configure volume, ritmo,
            frequência e narração por voz. {totalEnabled} de {alerts.length} ativos.
          </p>
        </header>

        {/* Global controls */}
        {global && (
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                {global.enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                Configuração global
              </h2>
              <button
                type="button"
                onClick={saveGlobal}
                disabled={saving === "__global__"}
                className="flex items-center gap-2 rounded-lg bg-neon-pink px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving === "__global__" ? "Salvando…" : "Salvar"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ToggleField
                label="Alertas sonoros ligados"
                description="Chave-mestra: desliga todos os alertas."
                checked={global.enabled}
                onChange={(v) => setGlobal({ ...global, enabled: v })}
              />

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Volume geral</span>
                  <span className="text-sm text-white/60">{global.master_volume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={global.master_volume}
                  onChange={(e) => setGlobal({ ...global, master_volume: Number(e.target.value) })}
                  className="w-full accent-neon-pink"
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <label className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                  <Timer className="h-4 w-4" />
                  Pedido atrasado após (minutos)
                </label>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={global.late_after_minutes}
                  onChange={(e) => setGlobal({ ...global, late_after_minutes: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-neon-pink"
                />
                <p className="mt-1 text-xs text-white/50">
                  Pedidos ainda em preparo passando desse tempo disparam o som de atraso.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <ToggleField
                  label={<span className="flex items-center gap-2"><Moon className="h-4 w-4" /> Horário silencioso</span>}
                  description="Silencia todos os alertas dentro do período."
                  checked={global.quiet_hours_enabled}
                  onChange={(v) => setGlobal({ ...global, quiet_hours_enabled: v })}
                />
                <div className={cn("mt-3 grid grid-cols-2 gap-2", !global.quiet_hours_enabled && "opacity-50")}>
                  <label className="text-xs text-white/60">
                    Início
                    <input
                      type="time"
                      value={global.quiet_start.slice(0, 5)}
                      onChange={(e) => setGlobal({ ...global, quiet_start: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-white outline-none focus:border-neon-pink"
                      disabled={!global.quiet_hours_enabled}
                    />
                  </label>
                  <label className="text-xs text-white/60">
                    Fim
                    <input
                      type="time"
                      value={global.quiet_end.slice(0, 5)}
                      onChange={(e) => setGlobal({ ...global, quiet_end: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-white outline-none focus:border-neon-pink"
                      disabled={!global.quiet_hours_enabled}
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Per-event alerts */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">Alertas por tipo de evento</h2>
          {loading && <p className="text-sm text-white/50">Carregando…</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {alerts.map((a) => {
              const Icon = ICONS[a.event_key] ?? Bell;
              const accent = ACCENT[a.event_key] ?? "from-white/10 to-white/5 text-white";
              return (
                <article
                  key={a.event_key}
                  className={cn(
                    "rounded-2xl border border-white/10 bg-gradient-to-br p-4 transition",
                    accent,
                    !a.enabled && "opacity-60",
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-black/40 p-2">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{a.label}</h3>
                        {a.description && (
                          <p className="text-xs text-white/60">{a.description}</p>
                        )}
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={a.enabled}
                      onChange={(v) => updateAlert(a.event_key, { enabled: v })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="col-span-2">
                      <span className="text-white/60">Preset</span>
                      <select
                        value={a.preset}
                        onChange={(e) => applyPreset(a.event_key, e.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-white outline-none focus:border-neon-pink"
                      >
                        <option value="beep">Beep clássico</option>
                        <option value="chime">Sino (chime)</option>
                        <option value="ding">Ding agudo</option>
                        <option value="alarm">Alarme insistente</option>
                        <option value="buzz">Buzz grave</option>
                        <option value="klaxon">Klaxon</option>
                        <option value="custom">Personalizado</option>
                      </select>
                    </label>

                    <label>
                      <span className="text-white/60">Forma de onda</span>
                      <select
                        value={a.waveform}
                        onChange={(e) => updateAlert(a.event_key, { waveform: e.target.value as SoundAlert["waveform"] })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-white outline-none focus:border-neon-pink"
                      >
                        <option value="sine">Senoide</option>
                        <option value="square">Quadrada</option>
                        <option value="triangle">Triangular</option>
                        <option value="sawtooth">Dente-de-serra</option>
                      </select>
                    </label>

                    <label>
                      <span className="text-white/60">Frequência (Hz)</span>
                      <input
                        type="number"
                        min={80}
                        max={8000}
                        value={a.frequency}
                        onChange={(e) => updateAlert(a.event_key, { frequency: Number(e.target.value) || 0 })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-white outline-none focus:border-neon-pink"
                      />
                    </label>

                    <label>
                      <span className="text-white/60">Duração (ms)</span>
                      <input
                        type="number"
                        min={40}
                        max={5000}
                        value={a.duration_ms}
                        onChange={(e) => updateAlert(a.event_key, { duration_ms: Number(e.target.value) || 0 })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-white outline-none focus:border-neon-pink"
                      />
                    </label>

                    <label>
                      <span className="text-white/60">Repetições</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={a.repeats}
                        onChange={(e) => updateAlert(a.event_key, { repeats: Math.max(1, Number(e.target.value) || 1) })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-white outline-none focus:border-neon-pink"
                      />
                    </label>

                    <label>
                      <span className="text-white/60">Intervalo (ms)</span>
                      <input
                        type="number"
                        min={0}
                        max={3000}
                        value={a.interval_ms}
                        onChange={(e) => updateAlert(a.event_key, { interval_ms: Math.max(0, Number(e.target.value) || 0) })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-white outline-none focus:border-neon-pink"
                      />
                    </label>

                    <label className="col-span-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-white/60">Volume</span>
                        <span className="text-white/70">{a.volume}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={a.volume}
                        onChange={(e) => updateAlert(a.event_key, { volume: Number(e.target.value) })}
                        className="w-full accent-neon-pink"
                      />
                    </label>

                    <label className="col-span-2">
                      <span className="text-white/60">URL de som personalizado (opcional)</span>
                      <input
                        type="url"
                        placeholder="https://…/som.mp3"
                        value={a.custom_url ?? ""}
                        onChange={(e) => updateAlert(a.event_key, { custom_url: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-white outline-none focus:border-neon-pink"
                      />
                      {a.custom_url && (
                        <p className="mt-1 text-[10px] text-white/40">
                          Quando preenchido, substitui o som sintetizado.
                        </p>
                      )}
                    </label>

                    <div className="col-span-2 rounded-xl border border-white/10 bg-black/30 p-2">
                      <ToggleField
                        label="Narrar por voz (TTS)"
                        description="Fala em português a mensagem abaixo depois do som."
                        checked={a.speak_enabled}
                        onChange={(v) => updateAlert(a.event_key, { speak_enabled: v })}
                        compact
                      />
                      {a.speak_enabled && (
                        <input
                          type="text"
                          placeholder="Ex.: Novo pedido recebido"
                          value={a.speak_text ?? ""}
                          onChange={(e) => updateAlert(a.event_key, { speak_text: e.target.value })}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-white outline-none focus:border-neon-pink"
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => testAlert(a)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                    >
                      <Play className="h-3.5 w-3.5" /> Testar
                    </button>
                    <button
                      type="button"
                      onClick={() => saveAlert(a)}
                      disabled={saving === a.event_key}
                      className="flex items-center gap-1.5 rounded-lg bg-neon-pink px-3 py-1.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saving === a.event_key ? "Salvando…" : "Salvar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <footer className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/50">
          Dica: o navegador exige um clique inicial para autorizar áudio.
          Deixe a aba aberta e o sistema fará soar os alertas em tempo real. Sons
          são únicos por evento — ao ouvi-los, você reconhece o que aconteceu sem
          olhar para a tela.
        </footer>
      </div>
    </AdminShell>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
  compact,
}: {
  label: React.ReactNode;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", !compact && "rounded-xl border border-white/10 bg-black/30 p-3")}>
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        {description && <p className="text-xs text-white/50">{description}</p>}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
        checked ? "bg-neon-pink" : "bg-white/15",
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
