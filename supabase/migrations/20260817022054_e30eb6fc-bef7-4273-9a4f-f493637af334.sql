-- Helper: which roles may modify/delete stored files
CREATE OR REPLACE FUNCTION public.can_write_attachments(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'manager'::app_role)
      OR public.has_role(_user_id, 'booking_agent'::app_role);
$$;

-- Remove duplicate / legacy policies on the attachments bucket
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete attachments" ON storage.objects;

-- Read: any signed-in staff member
CREATE POLICY "attachments_select_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'attachments');

-- Upload: any signed-in staff member
CREATE POLICY "attachments_insert_authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments');

-- Overwrite: staff with write privileges only
CREATE POLICY "attachments_update_writers"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'attachments' AND public.can_write_attachments(auth.uid()))
WITH CHECK (bucket_id = 'attachments' AND public.can_write_attachments(auth.uid()));

-- Delete: staff with write privileges only
CREATE POLICY "attachments_delete_writers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'attachments' AND public.can_write_attachments(auth.uid()));

-- Re-scope operations-documents policies from the broad public role to authenticated
DROP POLICY IF EXISTS "Admin/Manager can read operations-documents files" ON storage.objects;
DROP POLICY IF EXISTS "Admin/Manager can upload operations-documents files" ON storage.objects;
DROP POLICY IF EXISTS "Admin/Manager can update operations-documents files" ON storage.objects;
DROP POLICY IF EXISTS "Admin/Manager can delete operations-documents files" ON storage.objects;

CREATE POLICY "ops_docs_select_admin_manager"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'operations-documents' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)));

CREATE POLICY "ops_docs_insert_admin_manager"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'operations-documents' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)));

CREATE POLICY "ops_docs_update_admin_manager"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'operations-documents' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)))
WITH CHECK (bucket_id = 'operations-documents' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)));

CREATE POLICY "ops_docs_delete_admin_manager"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'operations-documents' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)));