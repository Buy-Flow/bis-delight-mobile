
-- Allow multiple automations per kind, add new kinds, name and filters
ALTER TABLE public.push_automations DROP CONSTRAINT IF EXISTS push_automations_kind_key;
ALTER TABLE public.push_automations DROP CONSTRAINT IF EXISTS push_automations_kind_check;
ALTER TABLE public.push_automations
  ADD CONSTRAINT push_automations_kind_check
  CHECK (kind IN ('birthday','dormant','welcome','after_order','abandoned_cart'));

ALTER TABLE public.push_automations
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS filters jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.push_automations SET name = COALESCE(name,
  CASE kind
    WHEN 'birthday' THEN 'Aniversariante do dia'
    WHEN 'dormant' THEN 'Cliente inativo'
    WHEN 'welcome' THEN 'Boas-vindas (1º pedido)'
    ELSE kind
  END);
