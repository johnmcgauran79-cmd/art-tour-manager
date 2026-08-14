GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_attachments TO authenticated;
GRANT ALL ON public.hotel_attachments TO service_role;

CREATE POLICY "Staff can delete hotel attachments"
ON public.hotel_attachments
FOR DELETE
TO authenticated
USING (
  auth.uid() = uploaded_by
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);