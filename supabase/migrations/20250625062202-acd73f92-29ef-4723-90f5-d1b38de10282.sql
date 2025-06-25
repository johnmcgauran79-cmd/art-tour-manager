
-- Drop the existing function and create a much simpler version
DROP FUNCTION IF EXISTS public.delete_booking_with_cascade(uuid);

-- Create a simple, fast database function without explicit commits
CREATE OR REPLACE FUNCTION public.delete_booking_with_cascade(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete associated records first (foreign key order)
  DELETE FROM hotel_bookings WHERE booking_id = p_booking_id;
  DELETE FROM activity_bookings WHERE booking_id = p_booking_id;
  
  -- Delete the booking itself
  DELETE FROM bookings WHERE id = p_booking_id;
  
  -- Simple logging without complex jsonb operations
  INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
  VALUES (
    auth.uid(),
    'DELETE_BOOKING_CASCADE',
    'bookings',
    p_booking_id,
    '{"cascade": true}'::jsonb
  );
END;
$$;
