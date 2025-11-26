-- Fix type mismatch in get_activity_allocation_discrepancies function
-- Cast booking_status enum to text

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
  SELECT 
    t.id as tour_id,
    t.name as tour_name,
    t.start_date as tour_start_date,
    b.id as booking_id,
    c.first_name as lead_passenger_first_name,
    c.last_name as lead_passenger_last_name,
    b.passenger_count,
    b.group_name,
    b.status::text, -- Cast enum to text
    a.id as activity_id,
    a.name as activity_name,
    a.activity_date,
    COALESCE(ab.passengers_attending, 0) as allocated_count,
    CASE 
      WHEN ab.passengers_attending IS NULL OR ab.passengers_attending = 0 THEN 'missing'
      WHEN ab.passengers_attending != b.passenger_count THEN 'mismatch'
    END as discrepancy_type
  FROM tours t
  INNER JOIN bookings b ON b.tour_id = t.id
  LEFT JOIN customers c ON c.id = b.lead_passenger_id
  CROSS JOIN activities a
  LEFT JOIN activity_bookings ab ON ab.booking_id = b.id AND ab.activity_id = a.id
  WHERE 
    t.status != 'archived'
    AND b.status NOT IN ('cancelled', 'waitlisted')
    AND a.tour_id = t.id
    AND (ab.passengers_attending IS NULL 
         OR ab.passengers_attending = 0 
         OR ab.passengers_attending != b.passenger_count)
  ORDER BY t.start_date, t.name, b.group_name, c.last_name, a.activity_date;
END;
$$;