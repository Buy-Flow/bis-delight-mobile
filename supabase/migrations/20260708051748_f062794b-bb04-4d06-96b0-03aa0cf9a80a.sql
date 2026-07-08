ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS option_groups jsonb;

WITH s AS (
  SELECT COALESCE(acai_config, '{}'::jsonb) AS cfg FROM public.site_settings WHERE id = 1
),
fruits AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id','f-'||t.ord, 'label', t.v, 'price', 0) ORDER BY t.ord), '[]'::jsonb) AS arr
  FROM s, jsonb_array_elements_text(COALESCE(s.cfg->'fruits','[]'::jsonb)) WITH ORDINALITY AS t(v, ord)
),
creams AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id','c-'||t.ord, 'label', t.v, 'price', 0) ORDER BY t.ord), '[]'::jsonb) AS arr
  FROM s, jsonb_array_elements_text(COALESCE(s.cfg->'creams','[]'::jsonb)) WITH ORDINALITY AS t(v, ord)
),
grp AS (
  SELECT jsonb_build_array(
    jsonb_build_object('id','tamanho','name','Tamanho','type','single','required', true, 'freeCount', 0, 'pricePerExtra', 0, 'options', COALESCE(s.cfg->'sizes', '[]'::jsonb)),
    jsonb_build_object('id','frutas','name','Frutas','type','multi','required', false, 'freeCount', COALESCE((s.cfg->>'freeFruits')::int, 2), 'pricePerExtra', COALESCE((s.cfg->>'extraFruitPrice')::numeric, 2), 'options', fruits.arr),
    jsonb_build_object('id','cremes','name','Cremes','type','multi','required', false, 'freeCount', COALESCE((s.cfg->>'freeCreams')::int, 1), 'pricePerExtra', COALESCE((s.cfg->>'extraCreamPrice')::numeric, 4), 'options', creams.arr),
    jsonb_build_object('id','complementos','name','Complementos','type','multi','required', false, 'freeCount', 0, 'pricePerExtra', 0, 'options', COALESCE(s.cfg->'extras', '[]'::jsonb))
  ) AS groups
  FROM s, fruits, creams
)
INSERT INTO public.products (
  id, name, category, image_url, description, ingredients,
  base_price, sizes, active, hero, sort_order, is_custom, option_groups
)
SELECT
  'monte-acai',
  'Monte seu açaí',
  'acai',
  '',
  'Personalize do seu jeito: escolha tamanho, frutas, cremes e complementos.',
  '[]'::jsonb,
  0,
  '[]'::jsonb,
  true,
  false,
  -1,
  true,
  groups
FROM grp
ON CONFLICT (id) DO UPDATE SET
  is_custom = EXCLUDED.is_custom,
  option_groups = EXCLUDED.option_groups,
  description = COALESCE(NULLIF(public.products.description,''), EXCLUDED.description);

ALTER TABLE public.site_settings DROP COLUMN IF EXISTS acai_config;