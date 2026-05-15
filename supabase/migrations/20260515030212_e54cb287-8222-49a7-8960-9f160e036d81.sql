DO $$
DECLARE ids uuid[];
BEGIN
  SELECT array_agg(id) INTO ids FROM tasks
   WHERE title IN ('Emergency Contact Collection', 'Travel Document Check');
  IF ids IS NULL THEN RETURN; END IF;
  DELETE FROM task_assignments WHERE task_id = ANY(ids);
  DELETE FROM task_activity_log WHERE task_id = ANY(ids);
  DELETE FROM tasks WHERE id = ANY(ids);
END $$;