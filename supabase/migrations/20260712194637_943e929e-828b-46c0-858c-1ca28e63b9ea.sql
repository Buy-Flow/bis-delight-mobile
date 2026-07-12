
CREATE TABLE public.ai_growth_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_growth_threads TO authenticated;
GRANT ALL ON public.ai_growth_threads TO service_role;
ALTER TABLE public.ai_growth_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "growth threads owner" ON public.ai_growth_threads
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ai_growth_threads_user_idx ON public.ai_growth_threads(user_id, updated_at DESC);

ALTER TABLE public.ai_growth_chat
  ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES public.ai_growth_threads(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ai_growth_chat_thread_idx ON public.ai_growth_chat(thread_id, created_at);
