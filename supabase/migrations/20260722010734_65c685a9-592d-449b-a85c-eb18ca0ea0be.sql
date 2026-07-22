
ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS payment_receipts_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.xero_payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  xero_invoice_id text NOT NULL,
  xero_invoice_number text,
  xero_payment_id text NOT NULL UNIQUE,
  amount numeric NOT NULL DEFAULT 0,
  currency_code text DEFAULT 'AUD',
  payment_date date,
  payment_reference text,
  invoice_total numeric,
  invoice_amount_paid numeric,
  invoice_amount_due numeric,
  recipient_email text,
  receipt_email_sent_at timestamptz,
  receipt_email_id text,
  skipped_reason text,
  send_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xero_payment_receipts_booking_idx ON public.xero_payment_receipts(booking_id);
CREATE INDEX IF NOT EXISTS xero_payment_receipts_invoice_idx ON public.xero_payment_receipts(xero_invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xero_payment_receipts TO authenticated;
GRANT ALL ON public.xero_payment_receipts TO service_role;

ALTER TABLE public.xero_payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager can view payment receipts"
  ON public.xero_payment_receipts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can manage payment receipts"
  ON public.xero_payment_receipts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_xero_payment_receipts_updated
  BEFORE UPDATE ON public.xero_payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-xero-payment-receipts-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'sync-xero-payment-receipts-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/sync-xero-payment-receipts',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcXZndHV4ZnpzcndqYWhrbGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTg3OTIsImV4cCI6MjA2NTA5NDc5Mn0.2XXCeilTJt-_0UdN_TCiT3Zyie_ci9Iwx6F7ZTsH0XQ"}'::jsonb,
    body := jsonb_build_object('trigger','cron','ts', now())
  );
  $$
);
