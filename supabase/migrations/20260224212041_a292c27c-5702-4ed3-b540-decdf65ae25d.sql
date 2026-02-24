CREATE TABLE public.invoice_sync_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  xero_invoice_id TEXT NOT NULL,
  proposed_status TEXT NOT NULL,
  current_status_at_dismissal TEXT NOT NULL,
  dismissed_by UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT,
  UNIQUE(booking_id, xero_invoice_id, proposed_status)
);

-- RLS
ALTER TABLE public.invoice_sync_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage invoice sync dismissals"
  ON public.invoice_sync_dismissals
  FOR ALL
  USING (true)
  WITH CHECK (true);