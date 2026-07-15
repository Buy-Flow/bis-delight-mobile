ALTER TABLE public.products ADD COLUMN IF NOT EXISTS hero_order integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(hero_order, 0), sort_order, name) - 1 AS rn
  FROM public.products WHERE hero = true
)
UPDATE public.products p SET hero_order = ranked.rn FROM ranked WHERE p.id = ranked.id;