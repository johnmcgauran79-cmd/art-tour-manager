ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS keap_match_checked_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_customers_keap_match_pending
  ON public.customers (keap_match_checked_at NULLS FIRST)
  WHERE keap_contact_id IS NULL;