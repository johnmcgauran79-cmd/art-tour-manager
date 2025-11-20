-- Create a database function to check for missing activity allocations
-- This replaces the complex JavaScript logic with a simple SQL query

CREATE OR REPLACE FUNCTION check_missing_activity_allocations()
RETURNS TABLE (
  booking_id uuid,
  tour_id uuid,
  tour_name text,
  start_date date,
  status text,
  passenger_count integer,
  first_name text,
  last_name text,
  tour_activities bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH tour_activity_counts AS (
    SELECT t.id as tour_id, COUNT(a.id) as activity_count
    FROM tours t
    JOIN activities a ON a.tour_id = t.id
    WHERE t.start_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY t.id
    HAVING COUNT(a.id) > 0
  ),
  booking_activity_counts AS (
    SELECT 
      b.id as booking_id,
      b.tour_id,
      COUNT(ab.id) as allocated_activities
    FROM bookings b
    LEFT JOIN activity_bookings ab ON ab.booking_id = b.id
    LEFT JOIN activities a ON ab.activity_id = a.id AND a.tour_id = b.tour_id
    WHERE b.tour_id IN (SELECT tac.tour_id FROM tour_activity_counts tac)
      AND b.status NOT IN ('cancelled', 'waitlisted')
    GROUP BY b.id, b.tour_id
  )
  SELECT 
    bac.booking_id,
    bac.tour_id,
    t.name as tour_name,
    t.start_date,
    b.status::text,
    b.passenger_count,
    c.first_name,
    c.last_name,
    tac.activity_count as tour_activities
  FROM booking_activity_counts bac
  JOIN tour_activity_counts tac ON bac.tour_id = tac.tour_id
  JOIN bookings b ON bac.booking_id = b.id
  JOIN tours t ON bac.tour_id = t.id
  LEFT JOIN customers c ON b.lead_passenger_id = c.id
  WHERE bac.allocated_activities = 0
  ORDER BY t.start_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;