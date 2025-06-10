
-- Create enum types for various status fields
CREATE TYPE tour_status AS ENUM ('pending', 'available', 'closed', 'sold_out', 'past');
CREATE TYPE booking_status AS ENUM ('pending', 'invoiced', 'deposited', 'paid', 'cancelled');
CREATE TYPE hotel_booking_status AS ENUM ('enquiry_sent', 'booked', 'pending');
CREATE TYPE activity_status AS ENUM ('pending', 'booked', 'paid_deposit', 'fully_paid', 'confirmed');
CREATE TYPE transport_status AS ENUM ('pending', 'booked', 'paid_deposit', 'fully_paid', 'confirmed');
CREATE TYPE bedding_type AS ENUM ('single', 'double', 'twin');

-- Customers table (contact database)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    spouse_name TEXT,
    dietary_requirements TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tours table
CREATE TABLE tours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days INTEGER NOT NULL,
    nights INTEGER NOT NULL,
    location TEXT,
    pickup_point TEXT,
    notes TEXT,
    status tour_status DEFAULT 'pending',
    inclusions TEXT,
    exclusions TEXT,
    price_single DECIMAL(10,2),
    price_double DECIMAL(10,2),
    price_twin DECIMAL(10,2),
    deposit_required DECIMAL(10,2),
    instalment_details TEXT,
    final_payment_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hotels table
CREATE TABLE hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    booking_status hotel_booking_status DEFAULT 'pending',
    rooms_reserved INTEGER DEFAULT 0,
    rooms_booked INTEGER DEFAULT 0,
    rooms_available INTEGER GENERATED ALWAYS AS (rooms_reserved - rooms_booked) STORED,
    default_check_in DATE,
    default_check_out DATE,
    default_room_type TEXT,
    extra_night_price DECIMAL(8,2),
    upgrade_options TEXT,
    operations_notes TEXT,
    contract_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activities table
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    activity_date DATE,
    spots_available INTEGER DEFAULT 0,
    spots_booked INTEGER DEFAULT 0,
    spots_remaining INTEGER GENERATED ALWAYS AS (spots_available - spots_booked) STORED,
    location TEXT,
    start_time TIME,
    end_time TIME,
    pickup_location TEXT,
    guide_name TEXT,
    guide_phone TEXT,
    guide_email TEXT,
    hospitality_inclusions TEXT,
    notes TEXT,
    transport_company TEXT,
    transport_contact_name TEXT,
    transport_phone TEXT,
    transport_email TEXT,
    pickup_time TIME,
    pickup_location_transport TEXT,
    dropoff_location TEXT,
    collection_time TIME,
    collection_location TEXT,
    transport_notes TEXT,
    activity_status activity_status DEFAULT 'pending',
    transport_status transport_status DEFAULT 'pending',
    operations_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings table
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
    lead_passenger_id UUID REFERENCES customers(id),
    passenger_count INTEGER NOT NULL DEFAULT 1,
    passenger_2_name TEXT,
    passenger_3_name TEXT,
    group_name TEXT,
    booking_agent TEXT,
    status booking_status DEFAULT 'pending',
    extra_requests TEXT,
    invoice_notes TEXT,
    accommodation_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hotel bookings (linking bookings to specific hotels with their details)
CREATE TABLE hotel_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    required BOOLEAN DEFAULT true,
    check_in_date DATE,
    check_out_date DATE,
    nights INTEGER,
    bedding bedding_type DEFAULT 'double',
    room_type TEXT,
    room_upgrade TEXT,
    room_requests TEXT,
    confirmation_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity bookings (linking bookings to activities with passenger counts)
CREATE TABLE activity_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    passengers_attending INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_bookings ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users to access all data (you can refine these later)
CREATE POLICY "Allow all operations for authenticated users" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for authenticated users" ON tours FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for authenticated users" ON hotels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for authenticated users" ON activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for authenticated users" ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for authenticated users" ON hotel_bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for authenticated users" ON activity_bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create triggers to update rooms_booked and spots_booked automatically
CREATE OR REPLACE FUNCTION update_hotel_rooms_booked()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE hotels 
    SET rooms_booked = (
        SELECT COUNT(*) 
        FROM hotel_bookings hb 
        JOIN bookings b ON hb.booking_id = b.id 
        WHERE hb.hotel_id = COALESCE(NEW.hotel_id, OLD.hotel_id)
        AND hb.required = true
        AND b.status != 'cancelled'
    )
    WHERE id = COALESCE(NEW.hotel_id, OLD.hotel_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hotel_rooms_booked_trigger
    AFTER INSERT OR UPDATE OR DELETE ON hotel_bookings
    FOR EACH ROW EXECUTE FUNCTION update_hotel_rooms_booked();

CREATE OR REPLACE FUNCTION update_activity_spots_booked()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE activities 
    SET spots_booked = (
        SELECT COALESCE(SUM(ab.passengers_attending), 0)
        FROM activity_bookings ab 
        JOIN bookings b ON ab.booking_id = b.id 
        WHERE ab.activity_id = COALESCE(NEW.activity_id, OLD.activity_id)
        AND b.status != 'cancelled'
    )
    WHERE id = COALESCE(NEW.activity_id, OLD.activity_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_activity_spots_booked_trigger
    AFTER INSERT OR UPDATE OR DELETE ON activity_bookings
    FOR EACH ROW EXECUTE FUNCTION update_activity_spots_booked();

-- Update triggers when booking status changes
CREATE OR REPLACE FUNCTION update_counts_on_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update hotel rooms booked
    UPDATE hotels 
    SET rooms_booked = (
        SELECT COUNT(*) 
        FROM hotel_bookings hb 
        JOIN bookings b ON hb.booking_id = b.id 
        WHERE hb.hotel_id = hotels.id
        AND hb.required = true
        AND b.status != 'cancelled'
    )
    WHERE id IN (
        SELECT hotel_id FROM hotel_bookings WHERE booking_id = NEW.id
    );
    
    -- Update activity spots booked
    UPDATE activities 
    SET spots_booked = (
        SELECT COALESCE(SUM(ab.passengers_attending), 0)
        FROM activity_bookings ab 
        JOIN bookings b ON ab.booking_id = b.id 
        WHERE ab.activity_id = activities.id
        AND b.status != 'cancelled'
    )
    WHERE id IN (
        SELECT activity_id FROM activity_bookings WHERE booking_id = NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_counts_on_booking_status_change_trigger
    AFTER UPDATE OF status ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_counts_on_booking_status_change();
