
CREATE POLICY "Admins read competitor-menus" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'competitor-menus' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins upload competitor-menus" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'competitor-menus' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins delete competitor-menus" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'competitor-menus' AND public.has_role(auth.uid(),'admin'));
