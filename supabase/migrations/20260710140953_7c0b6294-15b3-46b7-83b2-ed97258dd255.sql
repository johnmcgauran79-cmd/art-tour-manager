-- Allow one Xero invoice to be linked to multiple bookings (shared/group invoices).
-- Replace the single-column uniqueness on xero_invoice_id with a composite key.
ALTER TABLE public.xero_invoice_mappings
  DROP CONSTRAINT IF EXISTS xero_invoice_mappings_xero_invoice_id_key;

ALTER TABLE public.xero_invoice_mappings
  ADD CONSTRAINT xero_invoice_mappings_booking_invoice_key
  UNIQUE (booking_id, xero_invoice_id);