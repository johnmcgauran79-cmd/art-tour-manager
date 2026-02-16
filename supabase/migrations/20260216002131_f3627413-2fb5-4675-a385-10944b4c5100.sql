
-- Add invoice reference field to bookings for Xero matching
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_reference TEXT;

-- Create Xero integration settings table (stores OAuth tokens, org info)
CREATE TABLE IF NOT EXISTS xero_integration_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT, -- Xero organisation tenant ID
  tenant_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_connected BOOLEAN DEFAULT false,
  webhook_key TEXT, -- Xero webhook signing key
  last_contact_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE xero_integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage Xero settings"
ON xero_integration_settings FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

-- Create Xero invoice mappings (link Xero invoices to bookings)
CREATE TABLE IF NOT EXISTS xero_invoice_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  xero_invoice_id TEXT NOT NULL,
  xero_invoice_number TEXT,
  invoice_reference TEXT, -- matches bookings.invoice_reference
  amount_due NUMERIC(10,2),
  amount_paid NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2),
  currency_code TEXT DEFAULT 'AUD',
  xero_status TEXT, -- DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED
  last_payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(xero_invoice_id)
);

ALTER TABLE xero_invoice_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view Xero invoice mappings"
ON xero_invoice_mappings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage Xero invoice mappings"
ON xero_invoice_mappings FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

-- Create Xero sync log for audit trail
CREATE TABLE IF NOT EXISTS xero_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL, -- 'invoice_payment', 'contact_sync', 'webhook'
  entity_type TEXT, -- 'invoice', 'contact', 'payment'
  entity_id TEXT, -- Xero entity ID
  booking_id UUID REFERENCES bookings(id),
  customer_id UUID REFERENCES customers(id),
  action TEXT, -- 'status_updated', 'contact_created', 'contact_updated', 'payment_recorded'
  details JSONB,
  old_value TEXT,
  new_value TEXT,
  status TEXT DEFAULT 'success', -- 'success', 'failed', 'skipped'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE xero_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view Xero sync logs"
ON xero_sync_log FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Service role can manage Xero sync logs"
ON xero_sync_log FOR INSERT TO authenticated
WITH CHECK (true);

-- Insert default Xero integration settings row
INSERT INTO xero_integration_settings (is_connected) VALUES (false);
