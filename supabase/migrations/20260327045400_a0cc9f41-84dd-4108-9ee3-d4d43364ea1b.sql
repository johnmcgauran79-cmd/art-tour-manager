-- Temporarily disable USER triggers on hotel_bookings and bookings
ALTER TABLE hotel_bookings DISABLE TRIGGER USER;
ALTER TABLE bookings DISABLE TRIGGER USER;

-- Fix Lotte Seoul 1st stay: set check_out to 2026-09-08
UPDATE hotel_bookings
SET check_out_date = '2026-09-08',
    nights = (DATE '2026-09-08' - check_in_date)
WHERE hotel_id = '8613bf1c-50cb-41f5-b55e-a11af32380a8'
  AND check_out_date != '2026-09-08';

-- Fix Grand Hyatt Jeju: 07/09-09/09 -> 08/09-10/09
UPDATE hotel_bookings
SET check_in_date = '2026-09-08',
    check_out_date = '2026-09-10',
    nights = 2
WHERE hotel_id = 'e85912af-3262-45d7-9747-9e6066413a7c'
  AND check_in_date = '2026-09-07'
  AND check_out_date = '2026-09-09';

-- Recalculate parent booking dates for affected Korea tour bookings
WITH booking_dates AS (
  SELECT 
    hb.booking_id,
    MIN(hb.check_in_date) as earliest_check_in,
    MAX(hb.check_out_date) as latest_check_out
  FROM hotel_bookings hb
  JOIN bookings b ON b.id = hb.booking_id
  WHERE b.tour_id = '2bd6081d-9e06-4f83-b19b-eaafa0f12013'
    AND hb.allocated = true
    AND b.status != 'cancelled'
  GROUP BY hb.booking_id
)
UPDATE bookings b
SET check_in_date = bd.earliest_check_in,
    check_out_date = bd.latest_check_out,
    total_nights = (bd.latest_check_out - bd.earliest_check_in)
FROM booking_dates bd
WHERE b.id = bd.booking_id;

-- Re-enable triggers
ALTER TABLE hotel_bookings ENABLE TRIGGER USER;
ALTER TABLE bookings ENABLE TRIGGER USER;