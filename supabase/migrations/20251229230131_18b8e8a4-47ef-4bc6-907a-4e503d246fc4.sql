-- Update the auto_archive_completed_tours function to wait 7 days after tour end
CREATE OR REPLACE FUNCTION public.auto_archive_completed_tours()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_archived_count INTEGER := 0;
BEGIN
  -- Archive tours where end_date was 7+ days ago and status is not already archived or cancelled
  UPDATE tours
  SET status = 'archived'::tour_status,
      updated_at = now()
  WHERE end_date < CURRENT_DATE - INTERVAL '7 days'
  AND status NOT IN ('archived', 'cancelled');
  
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  
  -- Log the operation
  INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
  VALUES (
    (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1),
    'AUTO_ARCHIVE_TOURS',
    'tours',
    NULL,
    jsonb_build_object('archived_count', v_archived_count, 'days_after_completion', 7)
  );
  
  RETURN v_archived_count;
END;
$$;