
-- Update the hotel_booking_status enum to include the new status options
ALTER TYPE hotel_booking_status RENAME TO hotel_booking_status_old;

CREATE TYPE hotel_booking_status AS ENUM ('enquiry_sent', 'pending', 'contracted', 'updated', 'paid', 'finalised');

-- Update the hotels table to use the new enum
ALTER TABLE hotels 
ALTER COLUMN booking_status DROP DEFAULT,
ALTER COLUMN booking_status TYPE hotel_booking_status USING 
  CASE booking_status::text 
    WHEN 'booked' THEN 'contracted'::hotel_booking_status
    ELSE booking_status::text::hotel_booking_status 
  END,
ALTER COLUMN booking_status SET DEFAULT 'pending'::hotel_booking_status;

-- Drop the old enum
DROP TYPE hotel_booking_status_old;
