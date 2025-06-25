
-- Check if storage policies exist and create missing ones
DO $$
BEGIN
    -- Try to create policies, ignore if they already exist
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload attachments') THEN
        CREATE POLICY "Users can upload attachments" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view attachments') THEN
        CREATE POLICY "Users can view attachments" ON storage.objects
        FOR SELECT USING (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete attachments') THEN
        CREATE POLICY "Users can delete attachments" ON storage.objects
        FOR DELETE USING (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update attachments') THEN
        CREATE POLICY "Users can update attachments" ON storage.objects
        FOR UPDATE USING (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
    END IF;
END $$;
