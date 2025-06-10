
-- Fix security warnings by setting search_path for database functions
-- This prevents potential security issues with schema injection

-- Update the update_hotel_rooms_booked function to set search_path
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
$$ LANGUAGE plpgsql
SET search_path = public;

-- Update the update_activity_spots_booked function to set search_path
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
$$ LANGUAGE plpgsql
SET search_path = public;

-- Update the update_counts_on_booking_status_change function to set search_path
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
$$ LANGUAGE plpgsql
SET search_path = public;
