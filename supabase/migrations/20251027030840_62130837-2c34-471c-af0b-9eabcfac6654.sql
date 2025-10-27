-- Function to update itinerary dates when tour dates change
CREATE OR REPLACE FUNCTION public.update_itinerary_dates_on_tour_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_itinerary RECORD;
  v_day RECORD;
  v_days_offset INTEGER;
  v_new_date DATE;
BEGIN
  -- Only proceed if start_date changed
  IF OLD.start_date IS DISTINCT FROM NEW.start_date THEN
    
    -- Calculate the date offset (how many days the tour shifted)
    v_days_offset := NEW.start_date - OLD.start_date;
    
    -- Update all current itineraries for this tour
    FOR v_itinerary IN 
      SELECT id FROM tour_itineraries 
      WHERE tour_id = NEW.id AND is_current = true
    LOOP
      -- Update all days in this itinerary
      FOR v_day IN 
        SELECT id, activity_date 
        FROM tour_itinerary_days 
        WHERE itinerary_id = v_itinerary.id
      LOOP
        -- Calculate new date by adding the offset
        v_new_date := v_day.activity_date + v_days_offset;
        
        -- Update the day's activity_date
        UPDATE tour_itinerary_days
        SET activity_date = v_new_date,
            updated_at = now()
        WHERE id = v_day.id;
      END LOOP;
    END LOOP;
    
    -- Log the operation
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (
      COALESCE(auth.uid(), (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1)),
      'UPDATE_ITINERARY_DATES',
      'tours',
      NEW.id,
      jsonb_build_object(
        'old_start_date', OLD.start_date,
        'new_start_date', NEW.start_date,
        'days_offset', v_days_offset,
        'trigger_source', 'tour_date_change'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update itinerary dates when tour dates change
DROP TRIGGER IF EXISTS update_itinerary_dates_trigger ON public.tours;
CREATE TRIGGER update_itinerary_dates_trigger
  AFTER UPDATE ON public.tours
  FOR EACH ROW
  WHEN (OLD.start_date IS DISTINCT FROM NEW.start_date)
  EXECUTE FUNCTION public.update_itinerary_dates_on_tour_change();