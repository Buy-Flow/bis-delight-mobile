
-- Storage policies for whatsapp-media bucket: admins can read/write, service role bypass
CREATE POLICY "Admins read whatsapp-media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload whatsapp-media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update whatsapp-media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete whatsapp-media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'));
