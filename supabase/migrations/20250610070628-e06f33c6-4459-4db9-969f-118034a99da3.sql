
-- Create hotel_bookings table to link bookings to hotels with allocation details
CREATE TABLE IF NOT EXISTS public.hotel_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  allocated BOOLEAN DEFAULT false,
  check_in_date DATE,
  check_out_date DATE,
  nights INTEGER,
  bedding bedding_type DEFAULT 'double',
  room_type TEXT,
  room_upgrade TEXT,
  room_requests TEXT,
  confirmation_number TEXT,
  required BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create enum for bedding types if it doesn't exist
DO $$ BEGIN
  CREATE TYPE bedding_type AS ENUM ('single', 'double', 'twin', 'triple', 'family');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Update bedding column to use the enum
ALTER TABLE public.hotel_bookings 
ALTER COLUMN bedding TYPE bedding_type USING bedding::bedding_type;

-- Create function to calculate nights automatically
CREATE OR REPLACE FUNCTION calculate_nights(check_in DATE, check_out DATE)
RETURNS INTEGER AS $$
BEGIN
    IF check_in IS NULL OR check_out IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN check_out - check_in;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to update nights when dates change
CREATE OR REPLACE FUNCTION update_hotel_booking_nights()
RETURNS TRIGGER AS $$
BEGIN
    NEW.nights = calculate_nights(NEW.check_in_date, NEW.check_out_date);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for hotel_bookings
DROP TRIGGER IF EXISTS trigger_update_hotel_booking_nights ON public.hotel_bookings;
CREATE TRIGGER trigger_update_hotel_booking_nights
    BEFORE INSERT OR UPDATE ON public.hotel_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_hotel_booking_nights();

-- Create function to update hotel rooms booked count
CREATE OR REPLACE FUNCTION update_hotel_rooms_booked()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE hotels 
    SET rooms_booked = (
        SELECT COUNT(*) 
        FROM hotel_bookings hb 
        JOIN bookings b ON hb.booking_id = b.id 
        WHERE hb.hotel_id = COALESCE(NEW.hotel_id, OLD.hotel_id)
        AND hb.allocated = true
        AND b.status != 'cancelled'
    )
    WHERE id = COALESCE(NEW.hotel_id, OLD.hotel_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for hotel bookings to update rooms booked
DROP TRIGGER IF EXISTS trigger_update_hotel_rooms_booked ON public.hotel_bookings;
CREATE TRIGGER trigger_update_hotel_rooms_booked
    AFTER INSERT OR UPDATE OR DELETE ON public.hotel_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_hotel_rooms_booked();

-- Create function to update tour capacity when booking status changes
CREATE OR REPLACE FUNCTION update_tour_capacity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the tour's passenger count
    UPDATE tours 
    SET capacity = (
        SELECT COALESCE(SUM(passenger_count), 0)
        FROM bookings 
        WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
        AND status != 'cancelled'
    )
    WHERE id = COALESCE(NEW.tour_id, OLD.tour_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for bookings to update tour capacity
DROP TRIGGER IF EXISTS trigger_update_tour_capacity ON public.bookings;
CREATE TRIGGER trigger_update_tour_capacity
    AFTER INSERT OR UPDATE OR DELETE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_tour_capacity();

-- Enable RLS for hotel_bookings
ALTER TABLE public.hotel_bookings DISABLE ROW LEVEL SECURITY;
