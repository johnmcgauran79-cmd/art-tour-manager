GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_attachments TO authenticated;
GRANT ALL ON public.tour_attachments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;

CREATE POLICY "Staff can delete tour attachments"
ON public.tour_attachments
FOR DELETE
TO authenticated
USING (
  auth.uid() = uploaded_by
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Staff can delete task attachments"
ON public.task_attachments
FOR DELETE
TO authenticated
USING (
  auth.uid() = uploaded_by
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);