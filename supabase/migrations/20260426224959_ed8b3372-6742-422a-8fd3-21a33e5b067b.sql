-- Create enum for cancellation status
CREATE TYPE public.cancellation_refund_status AS ENUM (
  'waiting_for_refund',
  'cancellation_processed',
  'cash_refund_received',
  'credit_received',
  'no_refund'
);

-- Add cancellation fields to hotels
ALTER TABLE public.hotels
  ADD COLUMN cancellation_details text,
  ADD COLUMN cancellation_status public.cancellation_refund_status;

-- Add cancellation fields to activities
ALTER TABLE public.activities
  ADD COLUMN cancellation_details text,
  ADD COLUMN cancellation_status public.cancellation_refund_status;