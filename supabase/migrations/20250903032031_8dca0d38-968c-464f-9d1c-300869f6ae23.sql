-- Fix data inconsistency: Clear accommodation dates when accommodation_required is false
UPDATE bookings 
SET 
  check_in_date = NULL,
  check_out_date = NULL,
  total_nights = NULL
WHERE accommodation_required = false 
  AND (check_in_date IS NOT NULL OR check_out_date IS NOT NULL);