
CREATE TABLE public.copilot_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_threads TO authenticated;
GRANT ALL ON public.copilot_threads TO service_role;
ALTER TABLE public.copilot_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage own threads" ON public.copilot_threads FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.copilot_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX copilot_messages_thread_idx ON public.copilot_messages(thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_messages TO authenticated;
GRANT ALL ON public.copilot_messages TO service_role;
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage own messages" ON public.copilot_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.copilot_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.copilot_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));

CREATE TABLE public.copilot_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.copilot_threads(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  status text NOT NULL DEFAULT 'executed' CHECK (status IN ('executed','failed','undone','pending')),
  target_table text,
  target_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX copilot_actions_user_idx ON public.copilot_actions(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_actions TO authenticated;
GRANT ALL ON public.copilot_actions TO service_role;
ALTER TABLE public.copilot_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read actions" ON public.copilot_actions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins write actions" ON public.copilot_actions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') AND auth.uid() = user_id);
CREATE POLICY "admins update actions" ON public.copilot_actions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER copilot_threads_updated
  BEFORE UPDATE ON public.copilot_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
