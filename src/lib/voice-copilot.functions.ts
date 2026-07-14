import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DEFAULT_SETTINGS = {
  enabled: true,
  engine: "native" as "native" | "cloud",
  language: "pt-BR",
  auto_send: true,
  silence_ms: 1500,
  wake_word: null as string | null,
  push_to_talk: false,
  haptic: true,
  interim_preview: true,
  tts_reply: false,
  tts_voice: "alloy",
  tts_speed: 1.0,
  stt_model: "openai/gpt-4o-mini-transcribe",
};

export type VoiceCopilotSettings = typeof DEFAULT_SETTINGS & { user_id?: string };

export const getVoiceSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("voice_copilot_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return { ...DEFAULT_SETTINGS, user_id: userId };
    return data as VoiceCopilotSettings;
  });

const UpdateSchema = z.object({
  enabled: z.boolean().optional(),
  engine: z.enum(["native", "cloud"]).optional(),
  language: z.string().min(2).max(10).optional(),
  auto_send: z.boolean().optional(),
  silence_ms: z.number().int().min(300).max(8000).optional(),
  wake_word: z.string().max(40).nullable().optional(),
  push_to_talk: z.boolean().optional(),
  haptic: z.boolean().optional(),
  interim_preview: z.boolean().optional(),
  tts_reply: z.boolean().optional(),
  tts_voice: z.string().max(40).optional(),
  tts_speed: z.number().min(0.5).max(2.0).optional(),
  stt_model: z.string().max(80).optional(),
});

export const updateVoiceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => UpdateSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("voice_copilot_settings")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as VoiceCopilotSettings;
  });

const TranscribeSchema = z.object({
  audio_base64: z.string().min(1),
  mime_type: z.string().default("audio/webm"),
  language: z.string().default("pt-BR"),
  model: z.string().default("openai/gpt-4o-mini-transcribe"),
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => TranscribeSchema.parse(raw))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    const binary = atob(data.audio_base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ext = data.mime_type.includes("mp4") || data.mime_type.includes("m4a")
      ? "m4a"
      : data.mime_type.includes("wav")
      ? "wav"
      : data.mime_type.includes("mp3") || data.mime_type.includes("mpeg")
      ? "mp3"
      : "webm";
    const blob = new Blob([bytes], { type: data.mime_type });

    const form = new FormData();
    form.append("file", blob, `audio.${ext}`);
    form.append("model", data.model);
    if (data.language) form.append("language", data.language.split("-")[0]);
    form.append("response_format", "json");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Lovable-API-Key": key },
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Muitas transcrições — aguarde alguns segundos.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados — adicione créditos.");
      throw new Error(`Falha na transcrição (${res.status}): ${errText.slice(0, 200)}`);
    }
    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });

const TtsSchema = z.object({
  text: z.string().min(1).max(4000),
  voice: z.string().default("alloy"),
  speed: z.number().min(0.5).max(2.0).default(1.0),
});

export const speakText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => TtsSchema.parse(raw))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: data.text.slice(0, 3800),
        voice: data.voice,
        speed: data.speed,
        response_format: "mp3",
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Falha na síntese (${res.status}): ${errText.slice(0, 200)}`);
    }
    const buf = await res.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { audio_base64: btoa(binary), mime_type: "audio/mpeg" };
  });
