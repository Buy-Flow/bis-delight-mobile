
CREATE POLICY "Admins read cash-reports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cash-reports' AND public.has_role(auth.uid(), 'admin'));
