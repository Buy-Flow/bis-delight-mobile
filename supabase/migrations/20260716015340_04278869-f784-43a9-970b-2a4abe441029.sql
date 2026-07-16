UPDATE public.site_settings SET hero_images = jsonb_build_object(
  'left', jsonb_build_object('url','/__l5e/assets-v1/b223ea5c-b37e-460c-b0d8-2fe9ea8f220e/hero-bg-left-v2.png','offsetX',0,'offsetY',0,'scale',1),
  'right', jsonb_build_object('url','/__l5e/assets-v1/acfa9b61-d1d7-4481-8a28-678c1a6df4f7/hero-bg-right-v2.png','offsetX',0,'offsetY',0,'scale',1)
);