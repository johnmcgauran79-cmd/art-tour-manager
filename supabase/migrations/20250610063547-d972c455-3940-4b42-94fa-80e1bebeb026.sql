
-- Update customers table to match CRM contact structure
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS crm_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Create a table to track CRM sync status
CREATE TABLE IF NOT EXISTS crm_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES customers(id),
    crm_contact_id TEXT,
    sync_action TEXT CHECK (sync_action IN ('created', 'updated', 'deleted')),
    sync_status TEXT CHECK (sync_status IN ('pending', 'success', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update hotel_bookings table to include bedding and room details
ALTER TABLE hotel_bookings 
ADD COLUMN IF NOT EXISTS allocated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS room_upgrade TEXT,
ADD COLUMN IF NOT EXISTS confirmation_number TEXT;

-- Update bookings table to track accommodation requirements
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS check_in_date DATE,
ADD COLUMN IF NOT EXISTS check_out_date DATE,
ADD COLUMN IF NOT EXISTS total_nights INTEGER;

-- Enable RLS on new tables
ALTER TABLE crm_sync_log ENABLE ROW LEVEL SECURITY;

-- Create policies for the sync log table
CREATE POLICY "Allow all operations for authenticated users" ON crm_sync_log 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create function to calculate nights from check-in/out dates
CREATE OR REPLACE FUNCTION calculate_nights(check_in DATE, check_out DATE)
RETURNS INTEGER AS $$
BEGIN
    IF check_in IS NULL OR check_out IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN check_out - check_in;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically calculate nights in hotel_bookings
CREATE OR REPLACE FUNCTION update_hotel_booking_nights()
RETURNS TRIGGER AS $$
BEGIN
    NEW.nights = calculate_nights(NEW.check_in_date, NEW.check_out_date);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hotel_booking_nights_trigger
    BEFORE INSERT OR UPDATE ON hotel_bookings
    FOR EACH ROW EXECUTE FUNCTION update_hotel_booking_nights();
