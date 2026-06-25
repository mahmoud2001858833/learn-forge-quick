CREATE POLICY "tenant_logos_authenticated_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tenant-logos');
CREATE POLICY "tenant_logos_authenticated_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'tenant-logos') WITH CHECK (bucket_id = 'tenant-logos');
CREATE POLICY "tenant_logos_authenticated_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'tenant-logos');
CREATE POLICY "tenant_logos_anon_read" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'tenant-logos');