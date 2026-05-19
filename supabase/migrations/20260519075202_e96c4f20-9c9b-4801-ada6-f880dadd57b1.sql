ALTER TABLE public.xero_sync_log
DROP CONSTRAINT IF EXISTS xero_sync_log_booking_id_fkey;

ALTER TABLE public.xero_sync_log
ADD CONSTRAINT xero_sync_log_booking_id_fkey
FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;