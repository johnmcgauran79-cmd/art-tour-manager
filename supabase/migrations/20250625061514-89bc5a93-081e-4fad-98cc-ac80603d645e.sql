
-- Create a database function to handle cascading delete of bookings
CREATE OR REPLACE FUNCTION public.delete_booking_with_cascade(booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete associated hotel bookings
  DELETE FROM hotel_bookings WHERE booking_id = delete_booking_with_cascade.booking_id;
  
  -- Delete associated activity bookings
  DELETE FROM activity_bookings WHERE booking_id = delete_booking_with_cascade.booking_id;
  
  -- Delete the booking itself
  DELETE FROM bookings WHERE id = delete_booking_with_cascade.booking_id;
  
  -- Log the operation
  PERFORM log_sensitive_operation(
    'DELETE',
    'bookings',
    delete_booking_with_cascade.booking_id,
    jsonb_build_object('cascaded_delete', true)
  );
END;
$$;
