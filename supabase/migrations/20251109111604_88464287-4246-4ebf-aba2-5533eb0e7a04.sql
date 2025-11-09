-- Add 'archived' to tour_status enum if it doesn't exist
DO $$ BEGIN
  ALTER TYPE tour_status ADD VALUE IF NOT EXISTS 'archived';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create function to auto-archive completed tours
CREATE OR REPLACE FUNCTION auto_archive_completed_tours()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_archived_count INTEGER := 0;
BEGIN
  -- Archive tours where end_date has passed and status is not already archived or cancelled
  UPDATE tours
  SET status = 'archived'::tour_status,
      updated_at = now()
  WHERE end_date < CURRENT_DATE
  AND status NOT IN ('archived', 'cancelled');
  
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  
  -- Log the operation
  INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
  VALUES (
    (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1),
    'AUTO_ARCHIVE_TOURS',
    'tours',
    NULL,
    jsonb_build_object('archived_count', v_archived_count)
  );
  
  RETURN v_archived_count;
END;
$function$;