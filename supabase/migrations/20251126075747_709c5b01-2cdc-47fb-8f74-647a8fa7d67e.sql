-- Create automated report rules table
CREATE TABLE IF NOT EXISTS public.automated_report_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('weekly', 'monthly', 'days_before_tour')),
  schedule_value INTEGER NOT NULL, -- Day of week (0-6 for weekly), day of month (1-31 for monthly), or days before tour
  report_types TEXT[] NOT NULL, -- Array of report types like ['rooming_list', 'booking_changes', 'passenger_list']
  recipient_emails TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for active rules
CREATE INDEX idx_automated_report_rules_active ON public.automated_report_rules(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.automated_report_rules ENABLE ROW LEVEL SECURITY;

-- Create policies for automated report rules (admin only)
CREATE POLICY "Admins can view automated report rules"
  ON public.automated_report_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can insert automated report rules"
  ON public.automated_report_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update automated report rules"
  ON public.automated_report_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete automated report rules"
  ON public.automated_report_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create automated report log table to track sent reports
CREATE TABLE IF NOT EXISTS public.automated_report_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.automated_report_rules(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES public.tours(id) ON DELETE SET NULL,
  report_types TEXT[],
  recipient_emails TEXT[],
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message TEXT
);

-- Create index for log queries
CREATE INDEX idx_automated_report_log_sent_at ON public.automated_report_log(sent_at DESC);
CREATE INDEX idx_automated_report_log_rule_id ON public.automated_report_log(rule_id);