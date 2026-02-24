-- Drop the old unique constraint and add amount-based one
ALTER TABLE public.invoice_sync_dismissals 
  DROP CONSTRAINT invoice_sync_dismissals_booking_id_xero_invoice_id_proposed_key;

-- Add amount_paid_at_dismissal to track the Xero state when dismissed
ALTER TABLE public.invoice_sync_dismissals 
  ADD COLUMN amount_paid_at_dismissal NUMERIC DEFAULT 0,
  ADD COLUMN xero_status_at_dismissal TEXT;

-- New unique constraint: same booking+invoice+amount_paid = still dismissed
-- But if amount_paid changes (new payment), the dismissal won't match
ALTER TABLE public.invoice_sync_dismissals
  ADD CONSTRAINT invoice_sync_dismissals_unique_state 
  UNIQUE(booking_id, xero_invoice_id, amount_paid_at_dismissal);