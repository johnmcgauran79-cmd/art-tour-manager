CREATE TABLE public.instalment_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  xero_invoice_id text NOT NULL,
  xero_invoice_number text,
  booking_ids uuid[] NOT NULL DEFAULT '{}',
  pax_count integer NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'AUD',
  invoice_total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  amount_due numeric NOT NULL DEFAULT 0,
  instalment_expected numeric NOT NULL DEFAULT 0,
  deposit_expected numeric NOT NULL DEFAULT 0,
  shortfall numeric NOT NULL DEFAULT 0,
  invoice_due_date date,
  recipient_email text,
  recipient_name text,
  payment_link text,
  state text NOT NULL DEFAULT 'pending',
  hold_reason text,
  stop_reason text,
  reminder_count integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz,
  next_due_at date,
  last_email_id text,
  send_error text,
  actioned_by uuid,
  actioned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT instalment_reminders_unique_invoice UNIQUE (tour_id, xero_invoice_id)
);

GRANT SELECT ON public.instalment_reminders TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.instalment_reminders TO authenticated;
GRANT ALL ON public.instalment_reminders TO service_role;

ALTER TABLE public.instalment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view instalment reminders"
ON public.instalment_reminders FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'booking_agent')
  OR public.has_role(auth.uid(), 'agent')
);

CREATE POLICY "Admins and managers can manage instalment reminders"
ON public.instalment_reminders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE INDEX idx_instalment_reminders_state ON public.instalment_reminders (state, next_due_at);
CREATE INDEX idx_instalment_reminders_tour ON public.instalment_reminders (tour_id);

CREATE TRIGGER update_instalment_reminders_updated_at
BEFORE UPDATE ON public.instalment_reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();