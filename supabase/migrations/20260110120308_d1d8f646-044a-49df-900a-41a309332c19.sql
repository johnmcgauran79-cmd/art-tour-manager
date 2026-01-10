-- Drop both functions first
DROP FUNCTION IF EXISTS public.get_activity_allocation_discrepancies();
DROP FUNCTION IF EXISTS public.check_missing_activity_allocations();

-- Recreate get_activity_allocation_discrepancies to exclude past tours
CREATE FUNCTION public.get_activity_allocation_discrepancies()
RETURNS TABLE(
  tour_id uuid,
  tour_name text,
  tour_start_date date,
  booking_id uuid,
  group_name text,
  lead_passenger_first_name text,
  lead_passenger_last_name text,
  passenger_count integer,
  status text,
  activity_id uuid,
  activity_name text,
  activity_date date,
  allocated_count integer,
  discrepancy_type text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as tour_id,
    t.name as tour_name,
    t.start_date as tour_start_date,
    b.id as booking_id,
    b.group_name,
    c.first_name as lead_passenger_first_name,
    c.last_name as lead_passenger_last_name,
    b.passenger_count,
    b.status::text,
    a.id as activity_id,
    a.name as activity_name,
    a.activity_date,
    COALESCE(ab.passengers_attending, 0) as allocated_count,
    CASE 
      WHEN ab.passengers_attending IS NULL THEN 'not_allocated'
      WHEN ab.passengers_attending = 0 THEN 'zero_allocated'
      ELSE 'mismatch'
    END as discrepancy_type
  FROM tours t
  JOIN bookings b ON b.tour_id = t.id
  LEFT JOIN customers c ON c.id = b.lead_passenger_id
  JOIN activities a ON a.tour_id = t.id
  LEFT JOIN activity_bookings ab ON ab.booking_id = b.id AND ab.activity_id = a.id
  WHERE 
    t.status != 'archived'
    AND t.start_date >= CURRENT_DATE
    AND b.status NOT IN ('cancelled', 'waitlisted')
    AND a.tour_id = t.id
    AND (ab.passengers_attending IS NULL 
         OR ab.passengers_attending = 0 
         OR ab.passengers_attending != b.passenger_count)
  ORDER BY t.start_date, t.name, b.group_name, c.last_name, a.activity_date;
END;
$$;

-- Recreate check_missing_activity_allocations to exclude past tours
CREATE FUNCTION public.check_missing_activity_allocations()
RETURNS TABLE(
  booking_id uuid,
  tour_id uuid,
  tour_name text,
  start_date date,
  first_name text,
  last_name text,
  passenger_count integer,
  tour_activities bigint,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as booking_id,
    t.id as tour_id,
    t.name as tour_name,
    t.start_date,
    c.first_name,
    c.last_name,
    b.passenger_count,
    (SELECT COUNT(*) FROM activities a WHERE a.tour_id = t.id) as tour_activities,
    b.status::text
  FROM bookings b
  JOIN tours t ON t.id = b.tour_id
  LEFT JOIN customers c ON c.id = b.lead_passenger_id
  WHERE 
    t.status != 'archived'
    AND t.start_date >= CURRENT_DATE
    AND b.status NOT IN ('cancelled', 'waitlisted')
    AND EXISTS (SELECT 1 FROM activities a WHERE a.tour_id = t.id)
    AND (
      SELECT COUNT(*) 
      FROM activities a 
      WHERE a.tour_id = t.id
    ) > (
      SELECT COUNT(*) 
      FROM activity_bookings ab 
      JOIN activities a ON a.id = ab.activity_id 
      WHERE ab.booking_id = b.id 
      AND a.tour_id = t.id
      AND ab.passengers_attending > 0
    )
  ORDER BY t.start_date, t.name, c.last_name;
END;
$$;