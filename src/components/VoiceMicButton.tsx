import { useEffect, useState } from "react";
import { Mic, MicOff, Loader2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVoiceSettings, speakText, type VoiceCopilotSettings } from "@/lib/voice-copilot.functions";
import { useVoiceInput, isNativeVoiceSupported } from "@/lib/use-voice-input";

type Props = {
  onTranscript: (text: string) => void;
  autoSubmit?: (text: string) => void;
  compact?: boolean;
};

export function VoiceMicButton({ onTranscript, autoSubmit, compact }: Props) {
  const _get = useServerFn(getVoiceSettings);
  const settingsQuery = useQuery({
    queryKey: ["voice-copilot-settings"],
    queryFn: () => _get({}),
    staleTime: 60_000,
  });
  const settings: VoiceCopilotSettings | null = settingsQuery.data ?? null;

  const [showPanel, setShowPanel] = useState(false);

  const voice = useVoiceInput(settings, (text) => {
    if (!text) return;
    if (settings?.auto_send && autoSubmit) autoSubmit(text);
    else onTranscript(text);
    setShowPanel(false);
  });

  useEffect(() => {
    if (voice.error) {
      const t = setTimeout(() => {
        // clear error automatically after 3s by resetting via cancel (idempotent)
        voice.cancel();
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [voice.error, voice.cancel]);

  if (!settings?.enabled) return null;

  const supported = settings.engine === "cloud" ||
    (typeof window !== "undefined" && (isNativeVoiceSupported() || typeof MediaRecorder !== "undefined"));
  if (!supported) return null;

  const handleClick = () => {
    if (voice.isRecording) {
      voice.stop();
    } else {
      setShowPanel(true);
      voice.start();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={voice.isRecording ? "Parar" : "Falar"}
        aria-label={voice.isRecording ? "Parar gravação" : "Ditado por voz"}
        className={`${compact ? "h-11 w-11" : "h-12 w-12 md:h-11 md:w-11"} inline-flex flex-none items-center justify-center rounded-xl border transition active:scale-95 ${
          voice.isRecording
            ? "border-red-500/60 bg-red-500/20 text-red-200 animate-pulse"
            : "border-purple-500/30 bg-black/50 text-white/80 hover:bg-purple-500/10"
        }`}
      >
        {voice.isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>

      {showPanel && (voice.isRecording || voice.interim || voice.error) && (
        <div className="fixed inset-x-2 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-purple-500/30 bg-black/95 p-4 shadow-2xl backdrop-blur md:inset-x-auto md:right-8 md:bottom-8 md:max-w-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neon-yellow">
              {voice.isRecording ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  Ouvindo…
                </>
              ) : (
                <><Loader2 className="h-3 w-3 animate-spin" /> Processando</>
              )}
            </div>
            <button
              type="button"
              onClick={() => { voice.cancel(); setShowPanel(false); }}
              className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <VoiceMeter level={voice.level} active={voice.isRecording} />

          <p className="mt-3 min-h-[3rem] text-sm text-white/90">
            {voice.final && <span>{voice.final} </span>}
            {voice.interim && <span className="text-white/40 italic">{voice.interim}</span>}
            {!voice.final && !voice.interim && voice.isRecording && (
              <span className="text-white/40">Fale agora… {settings.auto_send ? "envio automático após pausa." : "toque em ✓ ao terminar."}</span>
            )}
          </p>

          {voice.error && (
            <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
              {voice.error}
            </p>
          )}

          <div className="mt-3 flex justify-end gap-2">
            {!settings.auto_send && voice.isRecording && (
              <button
                type="button"
                onClick={voice.stop}
                className="rounded-xl bg-gradient-to-br from-neon-yellow to-amber-400 px-4 py-2 text-sm font-semibold text-black active:scale-95"
              >
                Enviar
              </button>
            )}
            {!voice.isRecording && (
              <button
                type="button"
                onClick={() => setShowPanel(false)}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function VoiceMeter({ level, active }: { level: number; active: boolean }) {
  const bars = Array.from({ length: 20 });
  return (
    <div className="mt-3 flex h-10 items-center justify-center gap-1">
      {bars.map((_, i) => {
        const mid = (bars.length - 1) / 2;
        const d = 1 - Math.abs(i - mid) / mid;
        const h = active ? Math.max(4, level * 60 * (0.5 + d)) : 4;
        return (
          <span
            key={i}
            className="w-1 rounded-full bg-gradient-to-t from-purple-500 to-neon-yellow transition-[height]"
            style={{ height: `${Math.min(40, h)}px` }}
          />
        );
      })}
    </div>
  );
}

// Client helper for TTS reply playback
export async function playAssistantSpeech(text: string, voice: string, speed: number, tts: ReturnType<typeof useServerFn<typeof speakText>>) {
  const { audio_base64, mime_type } = await tts({ data: { text, voice, speed } });
  const audio = new Audio(`data:${mime_type};base64,${audio_base64}`);
  await audio.play().catch(() => {});
  return audio;
}
