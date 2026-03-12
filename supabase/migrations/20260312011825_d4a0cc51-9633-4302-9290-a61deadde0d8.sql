
-- Add column to control auto-allocation
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS auto_allocate_on_create boolean NOT NULL DEFAULT true;

-- Replace the trigger function to check the flag
CREATE OR REPLACE FUNCTION auto_allocate_hotel_to_bookings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only auto-allocate if the flag is set
  IF NEW.auto_allocate_on_create = true THEN
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
  END IF;
  
  RETURN NEW;
END;
$$;
