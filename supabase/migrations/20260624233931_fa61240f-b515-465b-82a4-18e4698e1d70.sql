-- Students upload to receipts/{tenant_id}/{user_id}/...
CREATE POLICY "Students upload own receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Students read own receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.is_tenant_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR public.has_tenant_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['admin']::tenant_role[])
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

CREATE POLICY "Students delete own pending receipts"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
