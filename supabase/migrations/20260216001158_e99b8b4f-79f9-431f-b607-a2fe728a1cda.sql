
-- Drop CRM-related policies
DROP POLICY IF EXISTS "Admins can manage CRM settings" ON crm_integration_settings;
DROP POLICY IF EXISTS "Admins can manage CRM sync logs" ON crm_sync_log;
DROP POLICY IF EXISTS "Admins can delete CRM sync logs" ON crm_sync_log;
DROP POLICY IF EXISTS "Admins can view CRM sync logs" ON crm_sync_log;

-- Drop CRM tables
DROP TABLE IF EXISTS crm_sync_log;
DROP TABLE IF EXISTS crm_integration_settings;

-- Remove CRM columns from customers table
ALTER TABLE customers DROP COLUMN IF EXISTS crm_id;
ALTER TABLE customers DROP COLUMN IF EXISTS last_synced_at;
