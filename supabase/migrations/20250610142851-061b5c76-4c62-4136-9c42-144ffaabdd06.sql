
-- Add revenue field to bookings table
ALTER TABLE public.bookings 
ADD COLUMN revenue NUMERIC DEFAULT 0;

-- Create function to calculate and update booking revenue
CREATE OR REPLACE FUNCTION calculate_booking_revenue()
RETURNS TRIGGER AS $$
DECLARE
    tour_single_price NUMERIC;
    tour_double_price NUMERIC;
    calculated_revenue NUMERIC;
BEGIN
    -- Skip calculation if booking is cancelled
    IF NEW.status = 'cancelled' THEN
        NEW.revenue = 0;
        RETURN NEW;
    END IF;
    
    -- Get tour prices
    SELECT price_single, price_double 
    INTO tour_single_price, tour_double_price
    FROM tours 
    WHERE id = NEW.tour_id;
    
    -- Calculate revenue based on passenger count
    IF NEW.passenger_count = 1 THEN
        calculated_revenue = COALESCE(tour_single_price, 0);
    ELSE
        calculated_revenue = NEW.passenger_count * COALESCE(tour_double_price, 0);
    END IF;
    
    NEW.revenue = calculated_revenue;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate revenue on insert/update
CREATE TRIGGER trigger_calculate_booking_revenue
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION calculate_booking_revenue();

-- Update existing bookings to calculate their revenue
UPDATE public.bookings 
SET revenue = CASE 
    WHEN status = 'cancelled' THEN 0
    WHEN passenger_count = 1 THEN (
        SELECT COALESCE(price_single, 0) 
        FROM tours 
        WHERE tours.id = bookings.tour_id
    )
    ELSE passenger_count * (
        SELECT COALESCE(price_double, 0) 
        FROM tours 
        WHERE tours.id = bookings.tour_id
    )
END;
