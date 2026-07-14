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

  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    silenceTimerRef.current = null;
    rafRef.current = null;
    try { nativeRef.current?.stop(); } catch {}
    nativeRef.current = null;
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const setupAnalyser = useCallback(async (stream: MediaStream) => {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
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
    } catch {}
  }, []);

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
        try { r.stop(); } catch {}
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
      setState((s) => ({ ...s, error: e?.error === "no-speech" ? "Não ouvi nada — tenta de novo." : `Erro: ${e?.error ?? "desconhecido"}` }));
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
    } catch {
      return false;
    }
  }, [cleanup, onFinal]);

  const startCloud = useCallback(async (settings: VoiceCopilotSettings) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
    } catch (err: any) {
      setState((s) => ({ ...s, error: err?.message ?? "Sem acesso ao microfone." }));
      cleanup();
      return false;
    }
  }, [_transcribe, cleanup, onFinal, setupAnalyser]);

  const start = useCallback(async () => {
    if (!settings) return;
    setState({ isRecording: false, interim: "", final: "", error: null, level: 0 });
    finalBufferRef.current = "";
    let ok = false;
    if (settings.engine === "native" && isNativeVoiceSupported()) {
      // Native does not expose a stream, so only meter via mic separately (skip for simplicity)
      ok = startNative(settings.language, settings.interim_preview, settings.auto_send, settings.silence_ms);
      if (!ok) ok = await startCloud(settings); // fallback
    } else {
      ok = await startCloud(settings);
    }
    if (ok) {
      if (settings.haptic && "vibrate" in navigator) try { navigator.vibrate?.(20); } catch {}
      setState((s) => ({ ...s, isRecording: true }));
    }
  }, [settings, startCloud, startNative]);

  const stop = useCallback(() => {
    if (settings?.haptic && "vibrate" in navigator) try { navigator.vibrate?.(10); } catch {}
    try { nativeRef.current?.stop(); } catch {}
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    } catch {}
  }, [settings]);

  const cancel = useCallback(() => {
    try { nativeRef.current?.abort(); } catch {}
    try { recorderRef.current?.stop(); } catch {}
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
