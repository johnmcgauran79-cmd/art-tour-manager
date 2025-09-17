-- Clear out old CRM sync data and create new integration settings
-- First, clear the old sync log data
TRUNCATE TABLE crm_sync_log;

-- Reset crm_id and last_synced_at for all customers
UPDATE customers 
SET crm_id = NULL, last_synced_at = NULL 
WHERE crm_id IS NOT NULL OR last_synced_at IS NOT NULL;

-- Create a new table for CRM integration settings
CREATE TABLE crm_integration_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL DEFAULT 'keap',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  webhook_url TEXT,
  api_key_configured BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'disconnected',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settings JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE crm_integration_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for CRM integration settings
CREATE POLICY "Admins can manage CRM settings" 
ON crm_integration_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_crm_integration_settings_updated_at
BEFORE UPDATE ON crm_integration_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default Keap integration record
INSERT INTO crm_integration_settings (provider_name, is_enabled, sync_status)
VALUES ('keap', false, 'disconnected');