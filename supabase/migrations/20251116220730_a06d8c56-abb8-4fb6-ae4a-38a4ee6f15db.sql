-- Fix duplicate alert triggers
-- The issue: Two triggers with different names are both firing on INSERT to bookings
-- trigger_alert_new_booking (from migration 20251114024150)
-- alert_new_booking_trigger (from migration 20251116122027)

-- Drop the old trigger name to prevent duplicates
DROP TRIGGER IF EXISTS trigger_alert_new_booking ON public.bookings;
DROP TRIGGER IF EXISTS trigger_check_activity_oversold ON public.activities;
DROP TRIGGER IF EXISTS trigger_check_hotel_oversold ON public.hotels;
DROP TRIGGER IF EXISTS trigger_alert_extra_nights ON public.hotel_bookings;

-- The newer triggers with proper naming already exist:
-- alert_new_booking_trigger
-- check_activity_oversold_trigger
-- check_hotel_oversold_trigger
-- alert_extra_nights_trigger
