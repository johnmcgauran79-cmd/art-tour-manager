-- Function to auto-allocate new hotels to existing bookings
CREATE OR REPLACE FUNCTION public.auto_allocate_hotel_to_bookings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- For each booking on this tour with accommodation required
  INSERT INTO hotel_bookings (
    booking_id,
    hotel_id,
    allocated,
    required,
    check_in_date,
    check_out_date,
    nights,
    bedding
  )
  SELECT 
    b.id,
    NEW.id,
    true,
    true,
    NEW.default_check_in,
    NEW.default_check_out,
    calculate_nights(NEW.default_check_in, NEW.default_check_out),
    CASE 
      WHEN b.passenger_count = 1 THEN 'single'::bedding_type
      ELSE 'double'::bedding_type
    END
  FROM bookings b
  WHERE b.tour_id = NEW.tour_id
  AND b.accommodation_required = true
  AND b.status != 'cancelled';
  
  RETURN NEW;
END;
$$;

-- Create trigger on hotels table
DROP TRIGGER IF EXISTS trigger_auto_allocate_hotel ON hotels;
CREATE TRIGGER trigger_auto_allocate_hotel
  AFTER INSERT ON hotels
  FOR EACH ROW
  EXECUTE FUNCTION auto_allocate_hotel_to_bookings();