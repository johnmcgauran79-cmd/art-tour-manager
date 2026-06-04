CREATE OR REPLACE FUNCTION public.cleanup_activity_generated_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete automated tasks that were generated for this specific activity
  -- (currently the 'activity_oversold' capacity rule). These tasks reference
  -- the activity by name in their title and carry automated_rule. Dependent
  -- rows (assignments, comments, attachments, etc.) are removed via FK cascade.
  DELETE FROM public.tasks
  WHERE is_automated = true
    AND automated_rule = 'activity_oversold'
    AND tour_id = OLD.tour_id
    AND title LIKE '%' || OLD.name || '%';

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_activity_generated_tasks_trigger ON public.activities;
CREATE TRIGGER cleanup_activity_generated_tasks_trigger
  BEFORE DELETE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_activity_generated_tasks();