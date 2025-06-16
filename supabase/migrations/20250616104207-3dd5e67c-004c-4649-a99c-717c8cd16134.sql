
-- Fix security warning by setting search_path for log_sensitive_operation function
CREATE OR REPLACE FUNCTION public.log_sensitive_operation(
  operation_type TEXT,
  table_name TEXT,
  record_id UUID,
  details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    user_id,
    operation_type,
    table_name,
    record_id,
    details,
    timestamp
  ) VALUES (
    auth.uid(),
    operation_type,
    table_name,
    record_id,
    details,
    now()
  );
END;
$$;
