
-- Drop the existing function and create an optimized version
DROP FUNCTION IF EXISTS public.delete_booking_with_cascade(uuid);

-- Create an optimized database function with better performance
CREATE OR REPLACE FUNCTION public.delete_booking_with_cascade(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_hotel_count INTEGER;
  v_deleted_activity_count INTEGER;
BEGIN
  -- Delete associated hotel bookings in batches and count
  DELETE FROM hotel_bookings 
  WHERE booking_id = p_booking_id;
  
  GET DIAGNOSTICS v_deleted_hotel_count = ROW_COUNT;
  
  -- Delete associated activity bookings in batches and count
  DELETE FROM activity_bookings 
  WHERE booking_id = p_booking_id;
  
  GET DIAGNOSTICS v_deleted_activity_count = ROW_COUNT;
  
  -- Delete the booking itself
  DELETE FROM bookings WHERE id = p_booking_id;
  
  -- Log the operation with summary
  PERFORM log_sensitive_operation(
    'DELETE',
    'bookings',
    p_booking_id,
    jsonb_build_object(
      'cascaded_delete', true,
      'hotel_bookings_deleted', v_deleted_hotel_count,
      'activity_bookings_deleted', v_deleted_activity_count
    )
  );
  
  -- Commit the transaction explicitly
  COMMIT;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise
    PERFORM log_sensitive_operation(
      'DELETE_ERROR',
      'bookings',
      p_booking_id,
      jsonb_build_object('error', SQLERRM)
    );
    RAISE;
END;
$$;
