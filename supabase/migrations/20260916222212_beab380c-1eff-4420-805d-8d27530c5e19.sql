ALTER TABLE public.instalment_reminders
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'instalment',
  ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS final_payment_date date,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_send boolean NOT NULL DEFAULT true;

ALTER TABLE public.instalment_reminders
  DROP CONSTRAINT IF EXISTS instalment_reminders_unique_invoice;

ALTER TABLE public.instalment_reminders
  ADD CONSTRAINT instalment_reminders_unique_invoice_kind UNIQUE (tour_id, xero_invoice_id, kind);

CREATE INDEX IF NOT EXISTS instalment_reminders_kind_state_idx
  ON public.instalment_reminders (kind, state, next_due_at);