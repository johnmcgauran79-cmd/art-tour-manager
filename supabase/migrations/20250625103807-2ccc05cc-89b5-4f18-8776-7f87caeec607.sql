
-- First, let's see what duplicates we have
-- This query will show duplicate activity_booking records
WITH duplicate_activity_bookings AS (
  SELECT 
    booking_id, 
    activity_id, 
    COUNT(*) as duplicate_count,
    array_agg(id) as booking_ids
  FROM activity_bookings 
  GROUP BY booking_id, activity_id 
  HAVING COUNT(*) > 1
)
SELECT * FROM duplicate_activity_bookings;

-- Clean up duplicate activity_bookings, keeping only the most recent one
WITH duplicate_records AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY booking_id, activity_id 
      ORDER BY created_at DESC
    ) as rn
  FROM activity_bookings
)
DELETE FROM activity_bookings 
WHERE id IN (
  SELECT id FROM duplicate_records WHERE rn > 1
);

-- Add a unique constraint to prevent future duplicates
ALTER TABLE activity_bookings 
DROP CONSTRAINT IF EXISTS activity_bookings_booking_id_activity_id_key;

ALTER TABLE activity_bookings 
ADD CONSTRAINT activity_bookings_booking_id_activity_id_key 
UNIQUE (booking_id, activity_id);

-- Update the spots_booked for all activities to recalculate correctly
UPDATE activities 
SET spots_booked = (
    SELECT COALESCE(SUM(ab.passengers_attending), 0)
    FROM activity_bookings ab 
    JOIN bookings b ON ab.booking_id = b.id 
    WHERE ab.activity_id = activities.id
    AND b.status NOT IN ('cancelled', 'pending')
);
