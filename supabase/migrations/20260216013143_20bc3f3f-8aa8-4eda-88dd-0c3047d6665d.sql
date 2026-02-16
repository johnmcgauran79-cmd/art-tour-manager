-- Allow admin users to delete from xero_sync_log (needed for bulk contact deletion)
CREATE POLICY "Admins can delete Xero sync logs"
ON public.xero_sync_log
FOR DELETE
USING (check_user_role(auth.uid(), 'admin'::text));
