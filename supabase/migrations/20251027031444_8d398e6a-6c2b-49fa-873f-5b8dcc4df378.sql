-- One-time fix: Update existing itinerary dates to match current tour dates
-- This recalculates all itinerary day dates based on the tour's current start_date

DO $$
DECLARE
  v_tour RECORD;
  v_itinerary RECORD;
  v_day RECORD;
  v_expected_date DATE;
BEGIN
  -- Loop through all tours
  FOR v_tour IN SELECT id, start_date, name FROM tours LOOP
    
    -- Loop through current itineraries for this tour
    FOR v_itinerary IN 
      SELECT id FROM tour_itineraries 
      WHERE tour_id = v_tour.id AND is_current = true
    LOOP
      
      -- Loop through days in this itinerary
      FOR v_day IN 
        SELECT id, day_number, activity_date 
        FROM tour_itinerary_days 
        WHERE itinerary_id = v_itinerary.id
        ORDER BY day_number
      LOOP
        -- Calculate expected date: tour start date + (day_number - 1)
        v_expected_date := v_tour.start_date + (v_day.day_number - 1);
        
        -- Update if the date doesn't match
        IF v_day.activity_date != v_expected_date THEN
          UPDATE tour_itinerary_days
          SET activity_date = v_expected_date,
              updated_at = now()
          WHERE id = v_day.id;
          
          RAISE NOTICE 'Updated % - Day %: % -> %', 
            v_tour.name, v_day.day_number, v_day.activity_date, v_expected_date;
        END IF;
      END LOOP;
      
    END LOOP;
  END LOOP;
END $$;