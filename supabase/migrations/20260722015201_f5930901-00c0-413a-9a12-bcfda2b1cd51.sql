
ALTER TABLE public.xero_payment_receipts
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.xero_payment_receipts
  DROP CONSTRAINT IF EXISTS xero_payment_receipts_approval_status_check;
ALTER TABLE public.xero_payment_receipts
  ADD CONSTRAINT xero_payment_receipts_approval_status_check
  CHECK (approval_status IN ('pending','approved','rejected','skipped'));

-- Backfill: any already-sent rows count as approved (auto); skipped stays skipped.
UPDATE public.xero_payment_receipts
SET approval_status = 'approved'
WHERE receipt_email_sent_at IS NOT NULL AND approval_status = 'pending';

UPDATE public.xero_payment_receipts
SET approval_status = 'skipped'
WHERE skipped_reason IS NOT NULL AND approval_status = 'pending';

CREATE INDEX IF NOT EXISTS xero_payment_receipts_approval_status_idx
  ON public.xero_payment_receipts (approval_status);
