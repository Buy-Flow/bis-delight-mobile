ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS news_subtitle text DEFAULT 'acabou de sair!',
  ADD COLUMN IF NOT EXISTS news_ticker text DEFAULT 'Lançamento fresquinho, Edição limitada, Só na Quero Bis, Novidade da semana';