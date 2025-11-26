-- Enable RLS on automated_report_log table
ALTER TABLE public.automated_report_log ENABLE ROW LEVEL SECURITY;

-- Create policies for automated report log (admin/manager view only)
CREATE POLICY "Admins and managers can view report logs"
  ON public.automated_report_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "System can insert report logs"
  ON public.automated_report_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);