
-- Create a secure function to delete automated tasks for a specific tour
CREATE OR REPLACE FUNCTION delete_automated_tour_tasks(p_tour_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_task_record RECORD;
BEGIN
  -- Delete automated tasks that are not completed or cancelled
  FOR v_task_record IN 
    SELECT id, title, status
    FROM tasks 
    WHERE tour_id = p_tour_id 
    AND is_automated = true
    AND status NOT IN ('completed', 'cancelled')
  LOOP
    -- Delete task assignments first
    DELETE FROM task_assignments WHERE task_id = v_task_record.id;
    
    -- Delete task comments
    DELETE FROM task_comments WHERE task_id = v_task_record.id;
    
    -- Delete task attachments
    DELETE FROM task_attachments WHERE task_id = v_task_record.id;
    
    -- Delete the task itself
    DELETE FROM tasks WHERE id = v_task_record.id;
    
    v_deleted_count := v_deleted_count + 1;
    
    RAISE NOTICE 'Deleted task: % (ID: %)', v_task_record.title, v_task_record.id;
  END LOOP;
  
  -- Log the operation
  INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
  VALUES (
    COALESCE(auth.uid(), (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1)),
    'DELETE_AUTOMATED_TASKS',
    'tasks',
    p_tour_id,
    jsonb_build_object('deleted_count', v_deleted_count)
  );
  
  RETURN v_deleted_count;
END;
$$;
