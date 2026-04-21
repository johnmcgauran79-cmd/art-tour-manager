DROP FUNCTION IF EXISTS public.log_task_activity(uuid, text, jsonb, jsonb, text);

CREATE OR REPLACE FUNCTION public.log_task_activity(
  p_task_id uuid,
  p_event_type text,
  p_old jsonb,
  p_new jsonb,
  p_message text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.task_activity_log (task_id, actor_id, event_type, old_value, new_value, message)
  VALUES (p_task_id, auth.uid(), p_event_type, p_old, p_new, p_message);
  -- Note: last_activity_at is set by the BEFORE UPDATE trigger on tasks (tasks_log_changes).
  -- Performing an UPDATE here would cause a "tuple already modified" error when this
  -- function is invoked from inside the BEFORE trigger of the same row.
END;
$$;