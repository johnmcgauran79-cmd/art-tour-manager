-- Add tour_id and booking_count columns for batch approvals
ALTER TABLE public.automated_email_log 
ADD COLUMN IF NOT EXISTS tour_id uuid REFERENCES public.tours(id),
ADD COLUMN IF NOT EXISTS booking_count integer DEFAULT 0;

-- Make booking_id nullable since batch approvals won't have individual booking IDs
ALTER TABLE public.automated_email_log 
ALTER COLUMN booking_id DROP NOT NULL;

-- Add index for efficient tour-based queries
CREATE INDEX IF NOT EXISTS idx_automated_email_log_tour_id ON public.automated_email_log(tour_id);

-- Delete existing pending approvals (they were individual, we'll recreate as batches)
DELETE FROM public.automated_email_log WHERE approval_status = 'pending_approval';