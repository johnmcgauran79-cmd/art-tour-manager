
-- Fix the tour date change trigger function to only update due dates, not regenerate tasks
CREATE OR REPLACE FUNCTION public.handle_tour_date_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template RECORD;
  v_reference_date DATE;
  v_due_date TIMESTAMP WITH TIME ZONE;
  v_hotel RECORD;
BEGIN
  -- Check if any relevant dates changed
  IF OLD.start_date IS DISTINCT FROM NEW.start_date OR 
     OLD.end_date IS DISTINCT FROM NEW.end_date OR 
     OLD.instalment_date IS DISTINCT FROM NEW.instalment_date OR 
     OLD.final_payment_date IS DISTINCT FROM NEW.final_payment_date THEN
    
    -- Get hotel dates for this tour if they exist
    SELECT initial_rooms_cutoff_date, final_rooms_cutoff_date
    INTO v_hotel
    FROM hotels 
    WHERE tour_id = NEW.id
    LIMIT 1;
    
    -- Update due dates for existing automated tasks (DO NOT CREATE NEW ONES)
    FOR v_template IN 
      SELECT tt.*, t.id as task_id
      FROM task_templates tt
      JOIN tasks t ON t.automated_rule = 'tour_operations_' || tt.id::text
      WHERE t.tour_id = NEW.id 
      AND t.is_automated = true
      AND t.status NOT IN ('completed', 'cancelled', 'archived')
      AND tt.is_active = true
    LOOP
      -- Determine the reference date based on date_field_type
      CASE v_template.date_field_type
        WHEN 'tour_start_date' THEN
          v_reference_date := NEW.start_date;
        WHEN 'tour_end_date' THEN
          v_reference_date := NEW.end_date;
        WHEN 'initial_rooms_cutoff_date' THEN
          v_reference_date := v_hotel.initial_rooms_cutoff_date;
        WHEN 'final_rooms_cutoff_date' THEN
          v_reference_date := v_hotel.final_rooms_cutoff_date;
        WHEN 'instalment_date' THEN
          v_reference_date := NEW.instalment_date;
        WHEN 'final_payment_date' THEN
          v_reference_date := NEW.final_payment_date;
        WHEN 'activity_cutoff_date' THEN
          -- For activity cutoff dates, get the earliest cutoff date from activities
          SELECT MIN(cutoff_date) INTO v_reference_date
          FROM activities 
          WHERE tour_id = NEW.id AND cutoff_date IS NOT NULL;
        ELSE
          v_reference_date := NEW.start_date; -- Default fallback
      END CASE;
      
      -- Only update if we have a reference date
      IF v_reference_date IS NOT NULL THEN
        -- Calculate new due date
        v_due_date := (v_reference_date - INTERVAL '1 day' * v_template.days_before_tour)::timestamp with time zone;
        
        -- Update the task's due date (DO NOT CREATE NEW TASKS)
        UPDATE tasks 
        SET due_date = v_due_date,
            updated_at = now()
        WHERE id = v_template.task_id;
      END IF;
    END LOOP;
    
    -- Log the date update
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (
      COALESCE(auth.uid(), (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1)),
      'UPDATE_TASK_DATES',
      'tours',
      NEW.id,
      jsonb_build_object(
        'old_start_date', OLD.start_date,
        'new_start_date', NEW.start_date,
        'old_end_date', OLD.end_date,
        'new_end_date', NEW.end_date,
        'trigger_source', 'tour_date_change'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger is properly configured
DROP TRIGGER IF EXISTS tour_date_change_trigger ON public.tours;

CREATE TRIGGER tour_date_change_trigger
  AFTER UPDATE ON public.tours
  FOR EACH ROW
  WHEN (OLD.start_date IS DISTINCT FROM NEW.start_date OR 
        OLD.end_date IS DISTINCT FROM NEW.end_date OR 
        OLD.instalment_date IS DISTINCT FROM NEW.instalment_date OR 
        OLD.final_payment_date IS DISTINCT FROM NEW.final_payment_date)
  EXECUTE FUNCTION handle_tour_date_change();
