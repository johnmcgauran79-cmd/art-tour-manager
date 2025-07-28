-- Function to handle customer name changes
CREATE OR REPLACE FUNCTION public.update_tour_host_from_customer()
RETURNS TRIGGER AS $$
DECLARE
    tour_record RECORD;
BEGIN
    -- Find all tours where this customer is the lead passenger with host status
    FOR tour_record IN 
        SELECT DISTINCT b.tour_id
        FROM bookings b
        WHERE b.lead_passenger_id = NEW.id
        AND b.status = 'host'
    LOOP
        -- Update each affected tour
        UPDATE tours 
        SET tour_host = CONCAT(NEW.first_name, ' ', NEW.last_name)
        WHERE id = tour_record.tour_id;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Function to update tour host based on host booking
CREATE OR REPLACE FUNCTION public.update_tour_host()
RETURNS TRIGGER AS $$
DECLARE
    host_passenger_name TEXT;
    tour_id_val UUID;
BEGIN
    -- Get the tour_id from the booking (works for both NEW and OLD)
    tour_id_val := COALESCE(NEW.tour_id, OLD.tour_id);
    
    -- Only proceed if we have a tour_id
    IF tour_id_val IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Find the lead passenger name from the booking with status 'host' for this tour
    SELECT CONCAT(c.first_name, ' ', c.last_name) INTO host_passenger_name
    FROM bookings b
    JOIN customers c ON b.lead_passenger_id = c.id
    WHERE b.tour_id = tour_id_val 
    AND b.status = 'host'
    LIMIT 1;
    
    -- Update the tour's host field
    UPDATE tours 
    SET tour_host = COALESCE(host_passenger_name, 'TBD')
    WHERE id = tour_id_val;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Create trigger for booking inserts and updates
CREATE OR REPLACE TRIGGER update_tour_host_on_booking_change
    AFTER INSERT OR UPDATE OF status, lead_passenger_id, tour_id ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_tour_host();

-- Create trigger for customer name updates (in case lead passenger name changes)
CREATE OR REPLACE TRIGGER update_tour_host_on_customer_change
    AFTER UPDATE OF first_name, last_name ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_tour_host_from_customer();