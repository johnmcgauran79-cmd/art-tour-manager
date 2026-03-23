
-- Table for configurable invoice line item templates
CREATE TABLE public.invoice_line_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_type text NOT NULL, -- 'description', 'single_supplement', 'loyalty_discount', 'payment_schedule', 'info_line'
  name text NOT NULL,
  description_template text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  unit_amount_type text NOT NULL DEFAULT 'zero', -- 'zero', 'fixed', 'percentage', 'calculated'
  unit_amount_value numeric DEFAULT NULL, -- for fixed amounts or percentage values
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_line_templates ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage invoice line templates"
  ON public.invoice_line_templates FOR ALL
  TO authenticated
  USING (check_user_role(auth.uid(), 'admin'))
  WITH CHECK (check_user_role(auth.uid(), 'admin'));

-- Managers can view
CREATE POLICY "Managers can view invoice line templates"
  ON public.invoice_line_templates FOR SELECT
  TO authenticated
  USING (check_user_role(auth.uid(), 'manager'));

-- Seed default templates matching current hardcoded logic
INSERT INTO public.invoice_line_templates (line_type, name, description_template, is_active, sort_order, unit_amount_type, unit_amount_value, created_by)
VALUES
  ('description', 'Invoice Description Line', '{{tour_name}} - {{passenger_names}} - {{room_type}}', true, 1, 'zero', NULL, '00000000-0000-0000-0000-000000000000'),
  ('single_supplement', 'Single Supplement', 'Single Supplement - {{tour_name}}', true, 2, 'calculated', NULL, '00000000-0000-0000-0000-000000000000'),
  ('loyalty_discount', 'Loyalty Discount', 'Loyalty Discount - Returning Customer ({{percentage}}%)', true, 3, 'percentage', 5, '00000000-0000-0000-0000-000000000000'),
  ('payment_schedule', 'Payment Schedule', 'PAYMENT SCHEDULE\n\n${{deposit_amount}} deposit per person\n${{instalment_amount}} instalment per person due {{instalment_date}}\nFINAL PAYMENT DUE {{final_payment_date}}', true, 5, 'zero', NULL, '00000000-0000-0000-0000-000000000000');
