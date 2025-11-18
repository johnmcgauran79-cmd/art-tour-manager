-- Add new booking status 'racing_breaks_invoice' to the booking_status enum
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'racing_breaks_invoice';