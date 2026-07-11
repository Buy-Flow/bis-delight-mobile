-- ai_insights
CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  priority text NOT NULL CHECK (priority IN ('ALTA','MEDIA','OPORTUNIDADE')),
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  impacto numeric(10,2) NOT NULL DEFAULT 0,
  clientes jsonb NOT NULL DEFAULT '[]'::jsonb,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dispatched','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights TO authenticated;
GRANT ALL ON public.ai_insights TO service_role;

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ai_insights"
  ON public.ai_insights FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can modify ai_insights"
  ON public.ai_insights FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX ai_insights_status_idx ON public.ai_insights (status, expires_at DESC);

-- ai_campaigns
CREATE TABLE public.ai_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid REFERENCES public.ai_insights(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  message text NOT NULL,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipients_count integer NOT NULL DEFAULT 0,
  dispatched_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','queued','failed'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_campaigns TO authenticated;
GRANT ALL ON public.ai_campaigns TO service_role;

ALTER TABLE public.ai_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ai_campaigns"
  ON public.ai_campaigns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can modify ai_campaigns"
  ON public.ai_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX ai_campaigns_dispatched_idx ON public.ai_campaigns (dispatched_at DESC);

-- ai_growth_chat (histórico do assistente conversacional)
CREATE TABLE public.ai_growth_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.ai_growth_chat TO authenticated;
GRANT ALL ON public.ai_growth_chat TO service_role;

ALTER TABLE public.ai_growth_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage own chat"
  ON public.ai_growth_chat FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id)
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

CREATE INDEX ai_growth_chat_user_idx ON public.ai_growth_chat (user_id, created_at);