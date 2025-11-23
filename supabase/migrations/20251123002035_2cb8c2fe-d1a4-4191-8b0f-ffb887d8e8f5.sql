-- Create automated_email_rules table
CREATE TABLE IF NOT EXISTS automated_email_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'booking_confirmation',
  days_before_tour INTEGER NOT NULL,
  email_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create automated_email_log table to track sent emails
CREATE TABLE IF NOT EXISTS automated_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES automated_email_rules(id) ON DELETE CASCADE,
  email_log_id UUID REFERENCES email_logs(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tour_start_date DATE NOT NULL,
  days_before_send INTEGER NOT NULL,
  UNIQUE(booking_id, rule_id)
);

-- Enable RLS
ALTER TABLE automated_email_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_email_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automated_email_rules
CREATE POLICY "Admins can manage automated email rules"
  ON automated_email_rules
  FOR ALL
  USING (check_user_role(auth.uid(), 'admin'))
  WITH CHECK (check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view automated email rules"
  ON automated_email_rules
  FOR SELECT
  USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager'));

-- RLS Policies for automated_email_log
CREATE POLICY "Admins can view automated email log"
  ON automated_email_log
  FOR SELECT
  USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager'));

CREATE POLICY "System can insert automated email log"
  ON automated_email_log
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_automated_email_log_booking_rule ON automated_email_log(booking_id, rule_id);
CREATE INDEX idx_automated_email_log_sent_at ON automated_email_log(sent_at);

-- Trigger to update updated_at
CREATE TRIGGER update_automated_email_rules_updated_at
  BEFORE UPDATE ON automated_email_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();