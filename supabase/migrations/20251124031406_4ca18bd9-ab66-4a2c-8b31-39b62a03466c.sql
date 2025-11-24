-- Create general_settings table for system-wide configuration
CREATE TABLE IF NOT EXISTS general_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE general_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage settings
CREATE POLICY "Admins can manage general settings"
ON general_settings
FOR ALL
USING (check_user_role(auth.uid(), 'admin'));

-- All authenticated users can view settings
CREATE POLICY "All authenticated users can view general settings"
ON general_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert default values for booking filter settings
INSERT INTO general_settings (setting_key, setting_value, description)
VALUES 
  ('deposits_owing_days', '14', 'Number of days after booking creation to flag deposits owing'),
  ('payment_due_days', '80', 'Number of days before tour start to flag final payments due')
ON CONFLICT (setting_key) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_general_settings_updated_at
  BEFORE UPDATE ON general_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();