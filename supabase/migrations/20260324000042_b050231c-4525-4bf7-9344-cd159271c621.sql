-- Add unique constraint on setting_key if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'general_settings_setting_key_key') THEN
    ALTER TABLE general_settings ADD CONSTRAINT general_settings_setting_key_key UNIQUE (setting_key);
  END IF;
END $$;

-- Insert default settings for email, token expiry, and invoice configuration
INSERT INTO general_settings (setting_key, setting_value, description) VALUES 
('default_sender_name', '"Australian Racing Tours"', 'Default sender name for outgoing emails'),
('default_from_email_client', '"bookings@australianracingtours.com.au"', 'Default from email for client-facing emails'),
('default_from_email_internal', '"info@australianracingtours.com.au"', 'Default from email for internal/automated emails'),
('token_expiry_hours', '168', 'Customer access token expiry in hours (default 7 days = 168 hours)'),
('invoice_due_date_days_before', '90', 'Days before tour start date for invoice due date'),
('invoice_due_date_fallback_days', '14', 'Fallback days from today if calculated due date is in the past'),
('loyalty_min_completed_tours', '1', 'Minimum completed tours for loyalty discount eligibility')
ON CONFLICT (setting_key) DO NOTHING;