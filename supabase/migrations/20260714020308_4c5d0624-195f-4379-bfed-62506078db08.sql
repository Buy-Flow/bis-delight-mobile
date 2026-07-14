
CREATE TABLE IF NOT EXISTS public.whatsapp_ai_settings (
  id text PRIMARY KEY DEFAULT 'default',
  enabled boolean NOT NULL DEFAULT false,
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  system_prompt text NOT NULL DEFAULT 'Você é a atendente virtual de uma sorveteria/açaíteria. Responda em português brasileiro, com tom simpático, curto e objetivo (máx 3 frases). Use emojis com moderação. Consulte SEMPRE as ferramentas para preços, estoque e horário — nunca invente números. Se não souber, seja honesta e ofereça falar com um humano.',
  greeting_message text NOT NULL DEFAULT 'Oi! 👋 Sou a atendente virtual. Posso te ajudar com cardápio, preços, entrega e horários. O que você precisa?',
  fallback_message text NOT NULL DEFAULT 'Não consegui te ajudar agora 😕 Vou chamar um humano do time, ok? Enquanto isso, se puder detalhar melhor, ajuda bastante!',
  out_of_hours_message text NOT NULL DEFAULT 'Estamos fechados agora 🌙 Assim que abrirmos te respondo. Você pode ir montando seu pedido pelo site!',
  reply_delay_ms integer NOT NULL DEFAULT 1500,
  max_replies_per_hour integer NOT NULL DEFAULT 20,
  business_hours_only boolean NOT NULL DEFAULT false,
  pause_after_human_min integer NOT NULL DEFAULT 30,
  handoff_keywords text[] NOT NULL DEFAULT ARRAY['humano','atendente','gerente','pessoa','falar com alguém','operador'],
  excluded_phones text[] NOT NULL DEFAULT ARRAY[]::text[],
  send_greeting boolean NOT NULL DEFAULT true,
  allow_stock boolean NOT NULL DEFAULT true,
  allow_price boolean NOT NULL DEFAULT true,
  allow_menu boolean NOT NULL DEFAULT true,
  allow_hours boolean NOT NULL DEFAULT true,
  allow_delivery boolean NOT NULL DEFAULT true,
  allow_promotions boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_ai_settings TO authenticated;
GRANT ALL ON public.whatsapp_ai_settings TO service_role;
ALTER TABLE public.whatsapp_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage wa_ai_settings"
  ON public.whatsapp_ai_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.whatsapp_ai_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;

CREATE TRIGGER trg_wa_ai_settings_updated BEFORE UPDATE ON public.whatsapp_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS ai_paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS ai_disabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.whatsapp_ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  phone text,
  user_message text,
  ai_reply text,
  tools_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  handoff boolean NOT NULL DEFAULT false,
  latency_ms integer,
  model text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.whatsapp_ai_logs TO authenticated;
GRANT ALL ON public.whatsapp_ai_logs TO service_role;
ALTER TABLE public.whatsapp_ai_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read wa_ai_logs"
  ON public.whatsapp_ai_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS wa_ai_logs_created_idx ON public.whatsapp_ai_logs (created_at DESC);
