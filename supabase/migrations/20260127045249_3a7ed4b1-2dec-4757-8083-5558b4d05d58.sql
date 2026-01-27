-- Add new booking status 'complimentary' to the booking_status enum
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'complimentary';