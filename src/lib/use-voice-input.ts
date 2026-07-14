import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { transcribeAudio, type VoiceCopilotSettings } from "@/lib/voice-copilot.functions";

// Web Speech API typing shim (browser-only)
type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getNativeRecognition(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isNativeVoiceSupported(): boolean {
  return !!getNativeRecognition();
}

export type VoiceInputState = {
  isRecording: boolean;
  interim: string;
  final: string;
  error: string | null;
  level: number; // 0..1 for waveform
};

/** Traduz erros de mídia/permissão para mensagens curtas em PT-BR. */
function friendlyMicError(err: unknown): string {
  const e = err as { name?: string; message?: string; error?: string } | null;
  const name = e?.name || e?.error || "";
  const msg = e?.message || "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "not-allowed":
      return "Permissão do microfone negada. Libere o acesso nas configurações do navegador.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Nenhum microfone encontrado. Conecte um dispositivo e tente novamente.";
    case "NotReadableError":
    case "AbortError":
      return "Microfone em uso por outro aplicativo. Feche-o e tente novamente.";
    case "no-speech":
      return "Não ouvi nada — tenta de novo.";
    case "audio-capture":
      return "Falha na captura de áudio. Verifique o microfone.";
    case "network":
      return "Erro de rede na transcrição. Verifique sua conexão.";
    case "service-not-allowed":
      return "Serviço de voz bloqueado pelo navegador ou sistema.";
    default:
      return msg || "Não foi possível acessar o microfone.";
  }
}

/** Consulta status de permissão sem quebrar em navegadores que não suportam. */
async function queryMicPermission(): Promise<PermissionState | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state;
  } catch {
    return null;
  }
}

export function useVoiceInput(settings: VoiceCopilotSettings | null, onFinal: (text: string) => void) {
  const _transcribe = useServerFn(transcribeAudio);
  const [state, setState] = useState<VoiceInputState>({
    isRecording: false,
    interim: "",
    final: "",
    error: null,
    level: 0,
  });

  const nativeRef = useRef<SR | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const finalBufferRef = useRef("");
  const permStatusRef = useRef<PermissionStatus | null>(null);
  const permChangeHandlerRef = useRef<(() => void) | null>(null);

  const setError = useCallback((err: unknown) => {
    const message = friendlyMicError(err);
    // eslint-disable-next-line no-console
    console.warn("[voice-input]", err);
    setState((s) => ({ ...s, error: message }));
  }, []);

  const detachPermissionWatcher = useCallback(() => {
    const status = permStatusRef.current;
    const handler = permChangeHandlerRef.current;
    if (status && handler) {
      try {
        status.removeEventListener?.("change", handler);
      } catch (e) {
        console.debug("[voice-input] removeEventListener failed", e);
      }
    }
    permStatusRef.current = null;
    permChangeHandlerRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    silenceTimerRef.current = null;
    rafRef.current = null;
    try {
      nativeRef.current?.stop();
    } catch (e) {
      console.debug("[voice-input] native.stop cleanup", e);
    }
    nativeRef.current = null;
    try {
      recorderRef.current?.stop();
    } catch (e) {
      console.debug("[voice-input] recorder.stop cleanup", e);
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch (e) {
        console.debug("[voice-input] track.stop cleanup", e);
      }
    });
    streamRef.current = null;
    try {
      audioCtxRef.current?.close();
    } catch (e) {
      console.debug("[voice-input] audioCtx.close cleanup", e);
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    detachPermissionWatcher();
  }, [detachPermissionWatcher]);

  useEffect(() => () => cleanup(), [cleanup]);

  const setupAnalyser = useCallback(async (stream: MediaStream) => {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx: AudioContext = new AC();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255;
        setState((s) => ({ ...s, level: avg }));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      // Meter é opcional — não bloqueia gravação, apenas log.
      console.debug("[voice-input] analyser setup failed", e);
    }
  }, []);

  /** Aborta tudo imediatamente com uma mensagem — usado quando permissão é revogada em runtime. */
  const abortWithError = useCallback((err: unknown) => {
    setError(err);
    try {
      nativeRef.current?.abort();
    } catch (e) {
      console.debug("[voice-input] native.abort", e);
    }
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    } catch (e) {
      console.debug("[voice-input] recorder.stop abort", e);
    }
    cleanup();
    setState((s) => ({ ...s, isRecording: false, interim: "", level: 0 }));
  }, [cleanup, setError]);

  const attachPermissionWatcher = useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      const handler = () => {
        if (status.state === "denied") {
          abortWithError({ name: "NotAllowedError" });
        }
      };
      status.addEventListener?.("change", handler);
      permStatusRef.current = status;
      permChangeHandlerRef.current = handler;
    } catch (e) {
      console.debug("[voice-input] permission watcher unsupported", e);
    }
  }, [abortWithError]);

  const startNative = useCallback((lang: string, interim: boolean, autoSend: boolean, silenceMs: number) => {
    const Ctor = getNativeRecognition();
    if (!Ctor) return false;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = interim;
    r.lang = lang;
    finalBufferRef.current = "";

    const resetSilence = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (!autoSend) return;
      silenceTimerRef.current = setTimeout(() => {
        try {
          r.stop();
        } catch (e) {
          console.debug("[voice-input] native.stop silence", e);
        }
      }, silenceMs);
    };

    r.onresult = (e: any) => {
      let interimText = "";
      let final = finalBufferRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0]?.transcript ?? "";
        if (res.isFinal) final += (final && !final.endsWith(" ") ? " " : "") + t;
        else interimText += t;
      }
      finalBufferRef.current = final;
      setState((s) => ({ ...s, interim: interimText, final }));
      resetSilence();
    };
    r.onerror = (e: any) => {
      // "no-speech" e "aborted" são não-fatais; qualquer outro erro deve ser visível ao usuário.
      const code = e?.error;
      if (code === "aborted") return;
      setError({ name: code, message: e?.message });
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
        abortWithError({ name: code });
      }
    };
    r.onend = () => {
      const finalText = finalBufferRef.current.trim();
      setState((s) => ({ ...s, isRecording: false, interim: "", level: 0 }));
      cleanup();
      if (finalText) onFinal(finalText);
    };
    nativeRef.current = r;
    try {
      r.start();
      resetSilence();
      return true;
    } catch (err) {
      setError(err);
      return false;
    }
  }, [abortWithError, cleanup, onFinal, setError]);

  const startCloud = useCallback(async (settings: VoiceCopilotSettings) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Se um dos tracks acabar (permissão revogada, cabo puxado), avise o usuário.
      stream.getTracks().forEach((t) => {
        t.onended = () => {
          if (recorderRef.current && recorderRef.current.state !== "inactive") {
            abortWithError({ name: "NotReadableError", message: "Microfone desconectado durante a gravação." });
          }
        };
      });

      await setupAnalyser(stream);
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onerror = (e: any) => setError(e?.error ?? { name: "NotReadableError" });
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        cleanup();
        if (blob.size < 800) {
          setState((s) => ({ ...s, isRecording: false, interim: "", level: 0, error: "Áudio muito curto." }));
          return;
        }
        setState((s) => ({ ...s, isRecording: false, interim: "transcrevendo…", level: 0 }));
        try {
          const b64 = await blobToBase64(blob);
          const { text } = await _transcribe({
            data: {
              audio_base64: b64,
              mime_type: blob.type || "audio/webm",
              language: settings.language,
              model: settings.stt_model,
            },
          });
          setState((s) => ({ ...s, interim: "", final: text }));
          if (text) onFinal(text);
        } catch (err: any) {
          setState((s) => ({ ...s, interim: "", error: err?.message ?? "Falha na transcrição." }));
        }
      };
      rec.start();
      return true;
    } catch (err) {
      setError(err);
      cleanup();
      return false;
    }
  }, [_transcribe, abortWithError, cleanup, onFinal, setError, setupAnalyser]);

  const start = useCallback(async () => {
    if (!settings) return;
    setState({ isRecording: false, interim: "", final: "", error: null, level: 0 });
    finalBufferRef.current = "";

    // Verificação proativa: se permissão já está negada, avise imediatamente sem tentar getUserMedia.
    const perm = await queryMicPermission();
    if (perm === "denied") {
      setError({ name: "NotAllowedError" });
      return;
    }

    // Ouça revogações mid-session
    await attachPermissionWatcher();

    let ok = false;
    if (settings.engine === "native" && isNativeVoiceSupported()) {
      ok = startNative(settings.language, settings.interim_preview, settings.auto_send, settings.silence_ms);
      if (!ok) ok = await startCloud(settings); // fallback
    } else {
      ok = await startCloud(settings);
    }
    if (ok) {
      if (settings.haptic && "vibrate" in navigator) {
        try {
          navigator.vibrate?.(20);
        } catch (e) {
          console.debug("[voice-input] vibrate", e);
        }
      }
      setState((s) => ({ ...s, isRecording: true }));
    } else {
      detachPermissionWatcher();
    }
  }, [attachPermissionWatcher, detachPermissionWatcher, setError, settings, startCloud, startNative]);

  const stop = useCallback(() => {
    if (settings?.haptic && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(10);
      } catch (e) {
        console.debug("[voice-input] vibrate stop", e);
      }
    }
    try {
      nativeRef.current?.stop();
    } catch (e) {
      console.debug("[voice-input] native.stop", e);
    }
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    } catch (e) {
      console.debug("[voice-input] recorder.stop", e);
    }
  }, [settings]);

  const cancel = useCallback(() => {
    try {
      nativeRef.current?.abort();
    } catch (e) {
      console.debug("[voice-input] native.abort", e);
    }
    try {
      recorderRef.current?.stop();
    } catch (e) {
      console.debug("[voice-input] recorder.stop cancel", e);
    }
    finalBufferRef.current = "";
    cleanup();
    setState({ isRecording: false, interim: "", final: "", error: null, level: 0 });
  }, [cleanup]);

  return { ...state, start, stop, cancel };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
