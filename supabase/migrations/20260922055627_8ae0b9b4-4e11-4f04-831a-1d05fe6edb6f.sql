ALTER TABLE public.instalment_reminders
  ADD COLUMN IF NOT EXISTS invoice_date date,
  ADD COLUMN IF NOT EXISTS booked_at date;