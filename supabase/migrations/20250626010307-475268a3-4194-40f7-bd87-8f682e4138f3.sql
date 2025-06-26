
-- Create trigger function for hotel date changes
CREATE OR REPLACE FUNCTION public.handle_hotel_date_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template RECORD;
  v_reference_date DATE;
  v_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Check if hotel cutoff dates changed
  IF OLD.initial_rooms_cutoff_date IS DISTINCT FROM NEW.initial_rooms_cutoff_date OR 
     OLD.final_rooms_cutoff_date IS DISTINCT FROM NEW.final_rooms_cutoff_date THEN
    
    -- Update due dates for existing automated tasks that depend on hotel dates
    FOR v_template IN 
      SELECT tt.*, t.id as task_id
      FROM task_templates tt
      JOIN tasks t ON t.automated_rule = 'tour_operations_' || tt.id::text
      WHERE t.tour_id = NEW.tour_id 
      AND t.is_automated = true
      AND t.status NOT IN ('completed', 'cancelled', 'archived')
      AND tt.is_active = true
      AND tt.date_field_type IN ('initial_rooms_cutoff_date', 'final_rooms_cutoff_date')
    LOOP
      -- Determine the reference date based on date_field_type
      CASE v_template.date_field_type
        WHEN 'initial_rooms_cutoff_date' THEN
          v_reference_date := NEW.initial_rooms_cutoff_date;
        WHEN 'final_rooms_cutoff_date' THEN
          v_reference_date := NEW.final_rooms_cutoff_date;
      END CASE;
      
      -- Only update if we have a reference date
      IF v_reference_date IS NOT NULL THEN
        -- Calculate new due date
        v_due_date := (v_reference_date - INTERVAL '1 day' * v_template.days_before_tour)::timestamp with time zone;
        
        -- Update the task's due date
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
      'UPDATE_TASK_DATES_HOTEL',
      'hotels',
      NEW.id,
      jsonb_build_object(
        'old_initial_cutoff', OLD.initial_rooms_cutoff_date,
        'new_initial_cutoff', NEW.initial_rooms_cutoff_date,
        'old_final_cutoff', OLD.final_rooms_cutoff_date,
        'new_final_cutoff', NEW.final_rooms_cutoff_date,
        'trigger_source', 'hotel_date_change'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger function for activity date changes
CREATE OR REPLACE FUNCTION public.handle_activity_date_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template RECORD;
  v_reference_date DATE;
  v_due_date TIMESTAMP WITH TIME ZONE;
  v_earliest_cutoff DATE;
BEGIN
  -- Check if activity cutoff date changed
  IF OLD.cutoff_date IS DISTINCT FROM NEW.cutoff_date THEN
    
    -- Get the new earliest cutoff date from all activities in this tour
    SELECT MIN(cutoff_date) INTO v_earliest_cutoff
    FROM activities 
    WHERE tour_id = NEW.tour_id AND cutoff_date IS NOT NULL;
    
    -- Update due dates for existing automated tasks that depend on activity cutoff dates
    FOR v_template IN 
      SELECT tt.*, t.id as task_id
      FROM task_templates tt
      JOIN tasks t ON t.automated_rule = 'tour_operations_' || tt.id::text
      WHERE t.tour_id = NEW.tour_id 
      AND t.is_automated = true
      AND t.status NOT IN ('completed', 'cancelled', 'archived')
      AND tt.is_active = true
      AND tt.date_field_type = 'activity_cutoff_date'
    LOOP
      -- Use the earliest cutoff date from all activities
      v_reference_date := v_earliest_cutoff;
      
      -- Only update if we have a reference date
      IF v_reference_date IS NOT NULL THEN
        -- Calculate new due date
        v_due_date := (v_reference_date - INTERVAL '1 day' * v_template.days_before_tour)::timestamp with time zone;
        
        -- Update the task's due date
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
      'UPDATE_TASK_DATES_ACTIVITY',
      'activities',
      NEW.id,
      jsonb_build_object(
        'old_cutoff_date', OLD.cutoff_date,
        'new_cutoff_date', NEW.cutoff_date,
        'earliest_cutoff_date', v_earliest_cutoff,
        'trigger_source', 'activity_date_change'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for hotel date changes
DROP TRIGGER IF EXISTS hotel_date_change_trigger ON public.hotels;
CREATE TRIGGER hotel_date_change_trigger
  AFTER UPDATE ON public.hotels
  FOR EACH ROW
  WHEN (OLD.initial_rooms_cutoff_date IS DISTINCT FROM NEW.initial_rooms_cutoff_date OR 
        OLD.final_rooms_cutoff_date IS DISTINCT FROM NEW.final_rooms_cutoff_date)
  EXECUTE FUNCTION handle_hotel_date_change();

-- Create triggers for activity date changes
DROP TRIGGER IF EXISTS activity_date_change_trigger ON public.activities;
CREATE TRIGGER activity_date_change_trigger
  AFTER UPDATE ON public.activities
  FOR EACH ROW
  WHEN (OLD.cutoff_date IS DISTINCT FROM NEW.cutoff_date)
  EXECUTE FUNCTION handle_activity_date_change();
