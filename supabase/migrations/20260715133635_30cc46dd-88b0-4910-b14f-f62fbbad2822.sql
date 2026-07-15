
DROP POLICY IF EXISTS "staff read delivery proofs" ON storage.objects;

CREATE POLICY "courier read own delivery proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.couriers c ON c.id = o.courier_id
      WHERE c.user_id = auth.uid()
        AND (
          o.id::text = split_part(storage.objects.name, '/', 1)
          OR o.id::text = split_part(storage.objects.name, '_', 1)
          OR position(o.id::text in storage.objects.name) > 0
        )
    )
  )
);
