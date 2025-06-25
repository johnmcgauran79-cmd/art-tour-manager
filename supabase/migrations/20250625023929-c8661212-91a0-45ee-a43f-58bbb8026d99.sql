
-- Drop all triggers that depend on the booking status column
DROP TRIGGER IF EXISTS update_counts_on_booking_status_change_trigger ON bookings;
DROP TRIGGER IF EXISTS trigger_update_counts_on_booking_status_change ON bookings;

-- Update the booking_status enum to include the new status options
ALTER TYPE booking_status RENAME TO booking_status_old;

CREATE TYPE booking_status AS ENUM ('pending', 'invoiced', 'deposited', 'instalment_paid', 'fully_paid', 'cancelled');

-- Update the bookings table to use the new enum
ALTER TABLE bookings 
ALTER COLUMN status DROP DEFAULT,
ALTER COLUMN status TYPE booking_status USING 
  CASE status::text 
    WHEN 'paid' THEN 'fully_paid'::booking_status
    ELSE status::text::booking_status 
  END,
ALTER COLUMN status SET DEFAULT 'pending'::booking_status;

-- Drop the old enum
DROP TYPE booking_status_old;

-- Remove payment tracking fields from bookings table
ALTER TABLE bookings 
DROP COLUMN IF EXISTS deposit_paid,
DROP COLUMN IF EXISTS deposit_paid_date,
DROP COLUMN IF EXISTS deposit_amount,
DROP COLUMN IF EXISTS instalment_paid,
DROP COLUMN IF EXISTS instalment_paid_date,
DROP COLUMN IF EXISTS instalment_amount,
DROP COLUMN IF EXISTS final_payment_paid,
DROP COLUMN IF EXISTS final_payment_paid_date,
DROP COLUMN IF EXISTS final_payment_amount;

-- Recreate the trigger
CREATE TRIGGER update_counts_on_booking_status_change_trigger
    AFTER UPDATE OF status ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_counts_on_booking_status_change();
