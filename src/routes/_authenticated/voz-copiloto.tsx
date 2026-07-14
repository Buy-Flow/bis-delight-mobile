import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import { getVoiceSettings, updateVoiceSettings, speakText, type VoiceCopilotSettings } from "@/lib/voice-copilot.functions";
import { isNativeVoiceSupported, useVoiceInput } from "@/lib/use-voice-input";
import { Mic, Play, Loader2, Info, Save, RotateCcw, Volume2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/voz-copiloto")({
  component: VoiceCopilotAdmin,
  head: () => ({
    meta: [
      { title: "Voz no Copiloto — Quero Bis" },
      { name: "description", content: "Ditado por voz e leitura em voz alta no Copiloto IA." },
    ],
  }),
});

const LANGUAGES = [
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "pt-PT", label: "Português (Portugal)" },
  { code: "en-US", label: "English (US)" },
  { code: "es-ES", label: "Español (España)" },
  { code: "es-MX", label: "Español (México)" },
  { code: "fr-FR", label: "Français" },
];

const VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse",
];

const STT_MODELS = [
  { id: "openai/gpt-4o-mini-transcribe", label: "Rápido e barato (recomendado)" },
  { id: "openai/gpt-4o-transcribe", label: "Alta precisão (mais caro)" },
];

function VoiceCopilotAdmin() {
  const _get = useServerFn(getVoiceSettings);
  const _update = useServerFn(updateVoiceSettings);
  const _tts = useServerFn(speakText);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["voice-copilot-settings"], queryFn: () => _get({}) });
  const [draft, setDraft] = useState<VoiceCopilotSettings | null>(null);

  useEffect(() => { if (data) setDraft(data); }, [data]);

  const mut = useMutation({
    mutationFn: (patch: Partial<VoiceCopilotSettings>) => _update({ data: patch }),
    onSuccess: (row) => {
      qc.setQueryData(["voice-copilot-settings"], row);
      setDraft(row);
      toast.success("Configurações salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = () => {
    if (!draft) return;
    const { user_id: _u, created_at: _c, updated_at: _up, ...rest } = draft as any;
    mut.mutate(rest);
  };
  const reset = () => data && setDraft(data);

  const nativeOk = isNativeVoiceSupported();

  // Live test
  const testVoice = useVoiceInput(draft, () => {});
  const [ttsBusy, setTtsBusy] = useState(false);

  const testTts = async () => {
    if (!draft) return;
    setTtsBusy(true);
    try {
      const { audio_base64, mime_type } = await _tts({ data: { text: "Copiloto pronto para te ajudar na loja.", voice: draft.tts_voice, speed: draft.tts_speed } });
      await new Audio(`data:${mime_type};base64,${audio_base64}`).play();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setTtsBusy(false); }
  };

  return (
    <AdminShell>
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Mic className="h-6 w-6 text-neon-yellow" /> Voz no Copiloto
            </h1>
            <p className="mt-1 text-sm text-white/60">
              Configure ditado por voz e leitura em voz alta — pensado pra correria da loja.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} disabled={!draft || mut.isPending} className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/5 disabled:opacity-40">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button onClick={save} disabled={!draft || mut.isPending} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-neon-yellow to-amber-400 px-4 py-2 text-sm font-semibold text-black active:scale-95 disabled:opacity-50">
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </button>
          </div>
        </header>

        {isLoading || !draft ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-white/50">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            {/* Compatibilidade */}
            <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60">Compatibilidade do dispositivo</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <StatusPill ok={nativeOk} okLabel="Web Speech API disponível" nokLabel="Web Speech API indisponível — usaremos a nuvem" />
                <StatusPill ok={typeof MediaRecorder !== "undefined"} okLabel="Gravação de áudio disponível" nokLabel="Gravação indisponível" />
              </div>
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-purple-500/10 p-3 text-xs text-purple-100">
                <Info className="mt-0.5 h-3 w-3 flex-none" />
                Motor <b>nativo</b> usa reconhecimento do próprio navegador (grátis, super rápido, pré-visualização em tempo real). Motor <b>nuvem</b> usa Lovable AI (mais preciso em ambiente barulhento, consome créditos).
              </p>
            </section>

            {/* Reconhecimento */}
            <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60">Reconhecimento de voz</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Toggle label="Ativar ditado por voz" hint="Mostra o botão de microfone no Copiloto." value={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />
                <Toggle label="Envio automático" hint="Envia sozinho após uma pausa. Desligue se quiser confirmar antes." value={draft.auto_send} onChange={(v) => setDraft({ ...draft, auto_send: v })} />

                <Field label="Idioma">
                  <select value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value })} className="input">
                    {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </Field>

                <Field label="Motor">
                  <select value={draft.engine} onChange={(e) => setDraft({ ...draft, engine: e.target.value as "native" | "cloud" })} className="input">
                    <option value="native">Nativo (rápido, grátis)</option>
                    <option value="cloud">Nuvem (preciso, IA)</option>
                  </select>
                </Field>

                {draft.engine === "cloud" && (
                  <Field label="Modelo de transcrição">
                    <select value={draft.stt_model} onChange={(e) => setDraft({ ...draft, stt_model: e.target.value })} className="input">
                      {STT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </Field>
                )}

                <Field label={`Pausa para envio automático: ${(draft.silence_ms / 1000).toFixed(1)}s`}>
                  <input type="range" min={500} max={5000} step={100} value={draft.silence_ms} onChange={(e) => setDraft({ ...draft, silence_ms: Number(e.target.value) })} className="w-full accent-yellow-400" />
                  <div className="flex justify-between text-[10px] text-white/40"><span>rápido</span><span>calmo</span></div>
                </Field>

                <Toggle label="Preview enquanto fala" hint="Mostra texto interino em tempo real (nativo)." value={draft.interim_preview} onChange={(v) => setDraft({ ...draft, interim_preview: v })} />
                <Toggle label="Vibração ao gravar" hint="Feedback tátil no celular." value={draft.haptic} onChange={(v) => setDraft({ ...draft, haptic: v })} />
              </div>

              {/* Live test */}
              <div className="mt-4 rounded-xl border border-purple-500/20 bg-black/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-white/50">Teste ao vivo</span>
                  <button
                    type="button"
                    onClick={() => (testVoice.isRecording ? testVoice.stop() : testVoice.start())}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${testVoice.isRecording ? "bg-red-500/20 text-red-200" : "bg-neon-yellow text-black"}`}
                  >
                    <Mic className="h-4 w-4" /> {testVoice.isRecording ? "Parar" : "Testar microfone"}
                  </button>
                </div>
                <div className="mt-3 min-h-[3rem] rounded-lg bg-black/50 p-3 text-sm text-white/80">
                  {testVoice.final || testVoice.interim || <span className="text-white/30">Toque em Testar e diga algo…</span>}
                </div>
                {testVoice.error && <p className="mt-2 text-xs text-red-300">{testVoice.error}</p>}
              </div>
            </section>

            {/* TTS */}
            <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60 flex items-center gap-2">
                <Volume2 className="h-4 w-4" /> Leitura em voz alta das respostas
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Toggle label="Ler resposta do Copiloto" hint="Bom pra ouvir enquanto trabalha." value={draft.tts_reply} onChange={(v) => setDraft({ ...draft, tts_reply: v })} />
                <Field label="Voz">
                  <select value={draft.tts_voice} onChange={(e) => setDraft({ ...draft, tts_voice: e.target.value })} className="input">
                    {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label={`Velocidade: ${draft.tts_speed.toFixed(2)}x`}>
                  <input type="range" min={0.5} max={2} step={0.05} value={draft.tts_speed} onChange={(e) => setDraft({ ...draft, tts_speed: Number(e.target.value) })} className="w-full accent-yellow-400" />
                </Field>
                <div className="flex items-end">
                  <button onClick={testTts} disabled={ttsBusy} className="inline-flex items-center gap-2 rounded-xl border border-purple-500/40 bg-black/40 px-3 py-2 text-sm text-white/80 hover:bg-purple-500/10">
                    {ttsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Testar voz
                  </button>
                </div>
              </div>
            </section>

            {/* Dicas */}
            <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">Dicas de uso</h2>
              <ul className="space-y-1 text-sm text-white/70">
                <li>• Diga comandos naturais: <i>"cria promoção de 20% nos shakes das 16 às 19"</i>.</li>
                <li>• Motor nativo funciona melhor no Chrome/Edge (Android e desktop). Safari iOS suporta com limitações.</li>
                <li>• Se o local for barulhento, prefira <b>Nuvem</b> — precisão bem maior.</li>
                <li>• Envio automático economiza toques, mas cuidado com ruído — desligue se ambiente for muito agitado.</li>
              </ul>
            </section>
          </>
        )}
      </div>

      <style>{`
        .input { width: 100%; border-radius: 0.75rem; border: 1px solid rgba(168, 85, 247, 0.3); background: rgba(0,0,0,0.5); padding: 0.55rem 0.75rem; font-size: 0.875rem; color: #fff; }
        .input:focus { outline: none; border-color: rgba(250,204,21,0.6); }
      `}</style>
    </AdminShell>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-white/50">{hint}</span>}
      </span>
      <span className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition ${value ? "bg-neon-yellow" : "bg-white/20"}`} onClick={() => onChange(!value)}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </span>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wider text-white/50">{label}</label>
      {children}
    </div>
  );
}

function StatusPill({ ok, okLabel, nokLabel }: { ok: boolean; okLabel: string; nokLabel: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
      {ok ? okLabel : nokLabel}
    </div>
  );
}
