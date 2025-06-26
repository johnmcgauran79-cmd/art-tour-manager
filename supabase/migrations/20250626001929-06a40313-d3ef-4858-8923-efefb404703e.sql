
-- First, let's make sure we have the trigger for handling tour date changes
-- Drop the existing trigger if it exists to recreate it properly
DROP TRIGGER IF EXISTS tour_date_change_trigger ON public.tours;

-- Create the trigger that will regenerate tasks when tour dates change
CREATE TRIGGER tour_date_change_trigger
  AFTER UPDATE ON public.tours
  FOR EACH ROW
  WHEN (OLD.start_date IS DISTINCT FROM NEW.start_date OR 
        OLD.end_date IS DISTINCT FROM NEW.end_date OR 
        OLD.instalment_date IS DISTINCT FROM NEW.instalment_date OR 
        OLD.final_payment_date IS DISTINCT FROM NEW.final_payment_date)
  EXECUTE FUNCTION handle_tour_date_change();

-- Also ensure we have the trigger for new tours
DROP TRIGGER IF EXISTS new_tour_trigger ON public.tours;

CREATE TRIGGER new_tour_trigger
  AFTER INSERT ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_tour();

-- Update the handle_tour_date_change function to be more comprehensive
CREATE OR REPLACE FUNCTION public.handle_tour_date_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if any relevant dates changed
  IF OLD.start_date IS DISTINCT FROM NEW.start_date OR 
     OLD.end_date IS DISTINCT FROM NEW.end_date OR 
     OLD.instalment_date IS DISTINCT FROM NEW.instalment_date OR 
     OLD.final_payment_date IS DISTINCT FROM NEW.final_payment_date THEN
    
    -- Archive existing automated tour operation tasks that are not completed
    UPDATE tasks 
    SET status = 'archived'
    WHERE tour_id = NEW.id 
    AND is_automated = true 
    AND automated_rule LIKE 'tour_operations_%'
    AND status NOT IN ('completed', 'cancelled');
    
    -- Generate new tasks with updated dates
    PERFORM generate_tour_operation_tasks(NEW.id);
    
    -- Log the regeneration
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (
      auth.uid(),
      'REGENERATE_TOUR_TASKS',
      'tours',
      NEW.id,
      jsonb_build_object(
        'old_start_date', OLD.start_date,
        'new_start_date', NEW.start_date,
        'old_end_date', OLD.end_date,
        'new_end_date', NEW.end_date
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;
