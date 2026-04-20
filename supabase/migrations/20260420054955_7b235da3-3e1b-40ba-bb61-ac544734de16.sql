-- 1. Add soft-cancellation columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS pre_cancellation_snapshot JSONB;

-- 2. Add soft-cancellation columns to hotel_bookings
ALTER TABLE public.hotel_bookings
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_cancelled_at ON public.hotel_bookings(cancelled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_cancelled_at ON public.bookings(cancelled_at);

-- 4. Update partial unique index to ignore cancelled rows
DROP INDEX IF EXISTS public.idx_hotel_bookings_unique_allocation;
CREATE UNIQUE INDEX idx_hotel_bookings_unique_allocation
  ON public.hotel_bookings(booking_id, hotel_id)
  WHERE allocated = true AND cancelled_at IS NULL;

-- 5. Backfill Robyn Watters' lost hotel allocations (disable audit trigger for this insert only)
ALTER TABLE public.hotel_bookings DISABLE TRIGGER USER;

INSERT INTO public.hotel_bookings (booking_id, hotel_id, allocated, cancelled_at, cancellation_reason)
SELECT 
  '62364fca-a34f-4c13-9979-75c4cf3cb87e'::uuid,
  v.hotel_id::uuid,
  true,
  '2026-04-20 01:25:23.734146+00'::timestamptz,
  'Restored from audit log - original cancellation: Robyn passed away.'
FROM (VALUES
  ('9953fe64-7508-4814-8a7a-2f846ae3b27b'),
  ('44515105-fdab-4c31-9ea3-0665a7da92b6')
) AS v(hotel_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.hotel_bookings hb
  WHERE hb.booking_id = '62364fca-a34f-4c13-9979-75c4cf3cb87e'::uuid 
    AND hb.hotel_id = v.hotel_id::uuid
);

ALTER TABLE public.hotel_bookings ENABLE TRIGGER USER;

-- 6. Backfill Robyn's cancellation metadata
UPDATE public.bookings 
SET 
  cancelled_at = '2026-04-20 01:25:23.734146+00'::timestamptz,
  cancellation_reason = 'Robyn passed away.',
  pre_cancellation_snapshot = jsonb_build_object(
    'note', 'Backfilled - original passenger_count/dates/revenue not preserved. Set these manually if restoring.',
    'backfilled', true
  )
WHERE id = '62364fca-a34f-4c13-9979-75c4cf3cb87e'
  AND status = 'cancelled'
  AND cancelled_at IS NULL;