
-- 1. Create new shared enums
CREATE TYPE public.booking_workflow_status AS ENUM (
  'pending',
  'enquiry_sent',
  'quote_received',
  'on_hold',
  'booked',
  'confirmed',
  'finalised',
  'cancelled'
);

CREATE TYPE public.payment_workflow_status AS ENUM (
  'unpaid',
  'partially_paid',
  'fully_paid',
  'cancelled'
);

-- 2. HOTELS: rename old booking_status -> legacy_status, add new booking_status + payment_status
ALTER TABLE public.hotels RENAME COLUMN booking_status TO legacy_status;

ALTER TABLE public.hotels
  ADD COLUMN booking_status public.booking_workflow_status NOT NULL DEFAULT 'pending',
  ADD COLUMN payment_status public.payment_workflow_status NOT NULL DEFAULT 'unpaid';

-- Backfill hotels
UPDATE public.hotels SET
  booking_status = CASE legacy_status::text
    WHEN 'pending'      THEN 'pending'::public.booking_workflow_status
    WHEN 'enquiry_sent' THEN 'enquiry_sent'::public.booking_workflow_status
    WHEN 'confirmed'    THEN 'confirmed'::public.booking_workflow_status
    WHEN 'contracted'   THEN 'booked'::public.booking_workflow_status
    WHEN 'updated'      THEN 'confirmed'::public.booking_workflow_status
    WHEN 'paid'         THEN 'confirmed'::public.booking_workflow_status
    WHEN 'finalised'    THEN 'finalised'::public.booking_workflow_status
    ELSE 'pending'::public.booking_workflow_status
  END,
  payment_status = CASE legacy_status::text
    WHEN 'paid'      THEN 'fully_paid'::public.payment_workflow_status
    WHEN 'finalised' THEN 'fully_paid'::public.payment_workflow_status
    ELSE 'unpaid'::public.payment_workflow_status
  END;

-- 3. ACTIVITIES: rename old activity_status -> legacy_status, add new booking_status + payment_status
ALTER TABLE public.activities RENAME COLUMN activity_status TO legacy_status;

ALTER TABLE public.activities
  ADD COLUMN booking_status public.booking_workflow_status NOT NULL DEFAULT 'pending',
  ADD COLUMN payment_status public.payment_workflow_status NOT NULL DEFAULT 'unpaid';

-- Backfill activities
UPDATE public.activities SET
  booking_status = CASE legacy_status::text
    WHEN 'pending'                 THEN 'pending'::public.booking_workflow_status
    WHEN 'contacted_enquiry_sent'  THEN 'enquiry_sent'::public.booking_workflow_status
    WHEN 'tentative_booking'       THEN 'on_hold'::public.booking_workflow_status
    WHEN 'on_hold'                 THEN 'on_hold'::public.booking_workflow_status
    WHEN 'booked'                  THEN 'booked'::public.booking_workflow_status
    WHEN 'confirmed'               THEN 'confirmed'::public.booking_workflow_status
    WHEN 'paid_deposit'            THEN 'confirmed'::public.booking_workflow_status
    WHEN 'fully_paid'              THEN 'confirmed'::public.booking_workflow_status
    WHEN 'finalised'               THEN 'finalised'::public.booking_workflow_status
    WHEN 'cancelled'               THEN 'cancelled'::public.booking_workflow_status
    ELSE 'pending'::public.booking_workflow_status
  END,
  payment_status = CASE legacy_status::text
    WHEN 'paid_deposit' THEN 'partially_paid'::public.payment_workflow_status
    WHEN 'fully_paid'   THEN 'fully_paid'::public.payment_workflow_status
    WHEN 'finalised'    THEN 'fully_paid'::public.payment_workflow_status
    WHEN 'cancelled'    THEN 'cancelled'::public.payment_workflow_status
    ELSE 'unpaid'::public.payment_workflow_status
  END;
