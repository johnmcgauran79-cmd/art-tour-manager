
-- Update archive function: also archive cancelled tours 7 days after cancellation
CREATE OR REPLACE FUNCTION public.auto_archive_completed_tours()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_archived_count INTEGER := 0;
BEGIN
  -- Archive tours where:
  -- 1. end_date was 7+ days ago and status is not already archived, OR
  -- 2. status is 'cancelled' and updated_at was 7+ days ago
  UPDATE tours
  SET status = 'archived'::tour_status,
      updated_at = now()
  WHERE status != 'archived'
  AND (
    (end_date < CURRENT_DATE - INTERVAL '7 days' AND status != 'cancelled')
    OR
    (status = 'cancelled' AND updated_at < now() - INTERVAL '7 days')
  );
  
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
