// Sound Alerts engine: synthesizes tones with WebAudio, plays custom URLs,
// optionally speaks the event via SpeechSynthesis. Respects master mute,
// global volume, and quiet hours. Reads config from Supabase.

import { supabase } from "@/integrations/supabase/client";

export type SoundEventKey =
  | "new_order"
  | "paid_order"
  | "late_order"
  | "cancelled_order"
  | "dispatched_order"
  | "delivered_order"
  | "low_stock"
  | "new_review";

export type SoundAlert = {
  event_key: SoundEventKey;
  label: string;
  description: string | null;
  enabled: boolean;
  preset: string;
  waveform: "sine" | "square" | "triangle" | "sawtooth";
  frequency: number;
  duration_ms: number;
  repeats: number;
  interval_ms: number;
  volume: number;
  custom_url: string | null;
  speak_enabled: boolean;
  speak_text: string | null;
  sort_index: number;
};

export type SoundGlobalSettings = {
  enabled: boolean;
  master_volume: number;
  quiet_hours_enabled: boolean;
  quiet_start: string; // "HH:MM" or "HH:MM:SS"
  quiet_end: string;
  late_after_minutes: number;
};

const DEFAULT_GLOBAL: SoundGlobalSettings = {
  enabled: true,
  master_volume: 80,
  quiet_hours_enabled: false,
  quiet_start: "22:00",
  quiet_end: "07:00",
  late_after_minutes: 30,
};

let _ctx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_ctx) return _ctx;
  const AC =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  _ctx = new AC();
  return _ctx;
}

/** User gesture unlock — call once after a click. */
export async function primeSoundContext(): Promise<void> {
  const ac = ctx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") await ac.resume();
  } catch {
    /* noop */
  }
}

function parseTime(t: string): { h: number; m: number } {
  const [h = "0", m = "0"] = t.split(":");
  return { h: Number(h) || 0, m: Number(m) || 0 };
}

function inQuietHours(g: SoundGlobalSettings, now: Date = new Date()): boolean {
  if (!g.quiet_hours_enabled) return false;
  const s = parseTime(g.quiet_start);
  const e = parseTime(g.quiet_end);
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = s.h * 60 + s.m;
  const end = e.h * 60 + e.m;
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  // wraps midnight
  return cur >= start || cur < end;
}

async function playCustomUrl(url: string, gainValue: number): Promise<void> {
  const ac = ctx();
  if (!ac) return;
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const audioBuf = await ac.decodeAudioData(buf);
    const src = ac.createBufferSource();
    src.buffer = audioBuf;
    const gain = ac.createGain();
    gain.gain.value = Math.max(0, Math.min(1, gainValue));
    src.connect(gain).connect(ac.destination);
    src.start();
  } catch {
    // Fallback via <audio>
    try {
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, gainValue));
      await audio.play();
    } catch {
      /* silent */
    }
  }
}

function playTone(
  waveform: OscillatorType,
  freq: number,
  durationMs: number,
  gainValue: number,
): Promise<void> {
  return new Promise((resolve) => {
    const ac = ctx();
    if (!ac) return resolve();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = waveform;
    osc.frequency.value = freq;
    const now = ac.currentTime;
    const dur = durationMs / 1000;
    const peak = Math.max(0, Math.min(1, gainValue));
    // ADSR-ish envelope for cleaner sound
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + Math.min(0.02, dur / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
    osc.onended = () => resolve();
  });
}

function speak(text: string, gainValue: number): void {
  if (typeof window === "undefined") return;
  const s = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  if (!s) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = 1;
    u.volume = Math.max(0, Math.min(1, gainValue));
    s.speak(u);
  } catch {
    /* noop */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Play a specific alert configuration (used by both listener and admin test). */
export async function playAlert(
  alert: SoundAlert,
  global: SoundGlobalSettings = DEFAULT_GLOBAL,
  opts: { ignoreQuietHours?: boolean; ignoreEnabled?: boolean } = {},
): Promise<void> {
  if (!opts.ignoreEnabled && !global.enabled) return;
  if (!opts.ignoreEnabled && !alert.enabled) return;
  if (!opts.ignoreQuietHours && inQuietHours(global)) return;

  const gain = (global.master_volume / 100) * (alert.volume / 100);

  if (alert.custom_url) {
    for (let i = 0; i < alert.repeats; i += 1) {
      await playCustomUrl(alert.custom_url, gain);
      if (i < alert.repeats - 1) await sleep(alert.interval_ms);
    }
  } else {
    for (let i = 0; i < alert.repeats; i += 1) {
      await playTone(alert.waveform, alert.frequency, alert.duration_ms, gain);
      if (i < alert.repeats - 1) await sleep(alert.interval_ms);
    }
  }

  if (alert.speak_enabled && alert.speak_text?.trim()) {
    speak(alert.speak_text.trim(), gain);
  }
}

export async function fetchGlobal(): Promise<SoundGlobalSettings> {
  const { data } = await supabase
    .from("sound_alert_settings" as never)
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return DEFAULT_GLOBAL;
  const row = data as unknown as SoundGlobalSettings;
  return { ...DEFAULT_GLOBAL, ...row };
}

export async function fetchAlerts(): Promise<SoundAlert[]> {
  const { data } = await supabase
    .from("sound_alerts" as never)
    .select("*")
    .order("sort_index", { ascending: true });
  return (data ?? []) as unknown as SoundAlert[];
}

export async function fetchAlert(key: SoundEventKey): Promise<SoundAlert | null> {
  const { data } = await supabase
    .from("sound_alerts" as never)
    .select("*")
    .eq("event_key", key)
    .maybeSingle();
  return (data ?? null) as SoundAlert | null;
}

/** Convenience for firing an alert by key, fetching fresh config. */
export async function fireAlert(key: SoundEventKey): Promise<void> {
  const [g, a] = await Promise.all([fetchGlobal(), fetchAlert(key)]);
  if (!a) return;
  await playAlert(a, g);
}
