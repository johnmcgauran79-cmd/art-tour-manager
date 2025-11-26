-- Fix search_path for the new function
DROP FUNCTION IF EXISTS get_activity_allocation_discrepancies();

CREATE OR REPLACE FUNCTION get_activity_allocation_discrepancies()
RETURNS TABLE (
  tour_id uuid,
  tour_name text,
  tour_start_date date,
  booking_id uuid,
  lead_passenger_first_name text,
  lead_passenger_last_name text,
  passenger_count integer,
  group_name text,
  status text,
  activity_id uuid,
  activity_name text,
  activity_date date,
  allocated_count integer,
  discrepancy_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH active_tours AS (
    SELECT t.id, t.name, t.start_date
    FROM tours t
    WHERE t.status != 'archived'
  ),
  tour_activities AS (
    SELECT a.id, a.tour_id, a.name, a.activity_date
    FROM activities a
    INNER JOIN active_tours at ON a.tour_id = at.id
  ),
  tour_bookings AS (
    SELECT 
      b.id, 
      b.tour_id, 
      b.passenger_count, 
      b.group_name, 
      b.status,
      b.lead_passenger_id,
      c.first_name,
      c.last_name
    FROM bookings b
    INNER JOIN active_tours at ON b.tour_id = at.id
    LEFT JOIN customers c ON b.lead_passenger_id = c.id
    WHERE b.status NOT IN ('cancelled', 'waitlisted')
  ),
  allocations AS (
    SELECT 
      ab.booking_id,
      ab.activity_id,
      COALESCE(ab.passengers_attending, 0) as passengers_attending
    FROM activity_bookings ab
  )
  SELECT 
    t.id as tour_id,
    t.name as tour_name,
    t.start_date as tour_start_date,
    b.id as booking_id,
    b.first_name as lead_passenger_first_name,
    b.last_name as lead_passenger_last_name,
    b.passenger_count,
    b.group_name,
    b.status,
    a.id as activity_id,
    a.name as activity_name,
    a.activity_date,
    COALESCE(al.passengers_attending, 0) as allocated_count,
    CASE 
      WHEN COALESCE(al.passengers_attending, 0) = 0 THEN 'missing'
      WHEN COALESCE(al.passengers_attending, 0) != b.passenger_count THEN 'mismatch'
    END as discrepancy_type
  FROM active_tours t
  INNER JOIN tour_activities a ON a.tour_id = t.id
  INNER JOIN tour_bookings b ON b.tour_id = t.id
  LEFT JOIN allocations al ON al.booking_id = b.id AND al.activity_id = a.id
  WHERE 
    COALESCE(al.passengers_attending, 0) = 0 
    OR COALESCE(al.passengers_attending, 0) != b.passenger_count
  ORDER BY t.start_date, b.first_name, b.last_name, a.activity_date;
END;
$$;