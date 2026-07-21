CREATE TABLE public.wordpress_integration_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  source TEXT NOT NULL,
  action TEXT NOT NULL,
  wordpress_object_type TEXT,
  wordpress_object_id INTEGER,
  request_summary JSONB,
  result_status TEXT NOT NULL,
  response_code INTEGER,
  error_message TEXT,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  dry_run BOOLEAN NOT NULL DEFAULT false,
  before_snapshot JSONB,
  after_snapshot JSONB
);

CREATE INDEX idx_wp_audit_created_at ON public.wordpress_integration_audit_logs (created_at DESC);
CREATE INDEX idx_wp_audit_user ON public.wordpress_integration_audit_logs (user_id);
CREATE INDEX idx_wp_audit_action ON public.wordpress_integration_audit_logs (action);
CREATE INDEX idx_wp_audit_object ON public.wordpress_integration_audit_logs (wordpress_object_type, wordpress_object_id);

GRANT SELECT, INSERT ON public.wordpress_integration_audit_logs TO authenticated;
GRANT ALL ON public.wordpress_integration_audit_logs TO service_role;

ALTER TABLE public.wordpress_integration_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view WordPress audit logs"
  ON public.wordpress_integration_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Users can insert their own WordPress audit rows"
  ON public.wordpress_integration_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);