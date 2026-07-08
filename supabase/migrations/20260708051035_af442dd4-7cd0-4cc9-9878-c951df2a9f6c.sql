ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS acai_config jsonb;

UPDATE public.site_settings
SET acai_config = jsonb_build_object(
  'sizes', jsonb_build_array(
    jsonb_build_object('id','300','label','300ml','price',20),
    jsonb_build_object('id','400','label','400ml','price',23),
    jsonb_build_object('id','500','label','500ml','price',28),
    jsonb_build_object('id','1000','label','1 Litro','price',43)
  ),
  'fruits', jsonb_build_array('Morango','Banana','Mamão','Maçã','Kiwi','Uva','Abacaxi'),
  'creams', jsonb_build_array('Creme de Ninho','Creme de Leite','Leite Condensado','Calda Quente','Creme de Ovomaltine','Creme de Nutella'),
  'extras', jsonb_build_array(
    jsonb_build_object('id','granola','label','Granola','price',2),
    jsonb_build_object('id','leite-condensado','label','Leite condensado','price',3),
    jsonb_build_object('id','nutella','label','Nutella','price',5),
    jsonb_build_object('id','ovomaltine','label','Ovomaltine','price',4),
    jsonb_build_object('id','pacoca','label','Paçoca','price',3),
    jsonb_build_object('id','amendoim','label','Amendoim','price',3),
    jsonb_build_object('id','leite-po','label','Leite em pó','price',3),
    jsonb_build_object('id','coco','label','Coco ralado','price',2),
    jsonb_build_object('id','chocoball','label','Chocoball','price',4),
    jsonb_build_object('id','mm','label','M&Ms','price',4)
  ),
  'freeFruits', 2,
  'freeCreams', 1,
  'extraFruitPrice', 2,
  'extraCreamPrice', 4
)
WHERE id = 1 AND acai_config IS NULL;