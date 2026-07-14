
CREATE TABLE public.voice_copilot_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  engine TEXT NOT NULL DEFAULT 'native' CHECK (engine IN ('native','cloud')),
  language TEXT NOT NULL DEFAULT 'pt-BR',
  auto_send BOOLEAN NOT NULL DEFAULT true,
  silence_ms INTEGER NOT NULL DEFAULT 1500 CHECK (silence_ms BETWEEN 300 AND 8000),
  wake_word TEXT,
  push_to_talk BOOLEAN NOT NULL DEFAULT false,
  haptic BOOLEAN NOT NULL DEFAULT true,
  interim_preview BOOLEAN NOT NULL DEFAULT true,
  tts_reply BOOLEAN NOT NULL DEFAULT false,
  tts_voice TEXT NOT NULL DEFAULT 'alloy',
  tts_speed NUMERIC NOT NULL DEFAULT 1.0 CHECK (tts_speed BETWEEN 0.5 AND 2.0),
  stt_model TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini-transcribe',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_copilot_settings TO authenticated;
GRANT ALL ON public.voice_copilot_settings TO service_role;

ALTER TABLE public.voice_copilot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own voice settings" ON public.voice_copilot_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER voice_copilot_settings_updated
BEFORE UPDATE ON public.voice_copilot_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
