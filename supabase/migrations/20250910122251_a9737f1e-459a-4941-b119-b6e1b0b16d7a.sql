-- Create email templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'booking_confirmation', 'dietary_request', 'contact_update', 'payment_reminder', etc.
  subject_template TEXT NOT NULL,
  content_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false, -- one default per type
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage email templates" 
ON public.email_templates 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view email templates" 
ON public.email_templates 
FOR SELECT 
USING (has_role(auth.uid(), 'booking_agent'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default booking confirmation template
INSERT INTO public.email_templates (name, type, subject_template, content_template, is_default, created_by) VALUES 
('Default Booking Confirmation', 'booking_confirmation', 
'Booking Confirmation - {{tour_name}}',
'Dear {{customer_first_name}} {{customer_last_name}},

Thank you for your booking! Please find your booking confirmation details below:

TOUR DETAILS:
• Tour: {{tour_name}}
• Location: {{tour_location}}
• Tour Dates: {{tour_start_date}} - {{tour_end_date}}
• Duration: {{tour_days}} days, {{tour_nights}} nights
• Pickup Point: {{tour_pickup_point}}

PASSENGER INFORMATION:
• Lead Passenger: {{customer_first_name}} {{customer_last_name}}
• Email: {{customer_email}}
• Phone: {{customer_phone}}
• Total Passengers: {{booking_passenger_count}}{{#booking_passenger_2_name}}
• Passenger 2: {{booking_passenger_2_name}}{{/booking_passenger_2_name}}{{#booking_passenger_3_name}}
• Passenger 3: {{booking_passenger_3_name}}{{/booking_passenger_3_name}}{{#booking_group_name}}
• Group Name: {{booking_group_name}}{{/booking_group_name}}

ACCOMMODATION:{{#hotel_bookings}}
• {{hotel_name}}: {{hotel_check_in_date}} - {{hotel_check_out_date}}, {{hotel_room_type}} room, {{hotel_bedding}} bed{{#hotel_room_upgrade}}, Upgrade: {{hotel_room_upgrade}}{{/hotel_room_upgrade}}{{/hotel_bookings}}{{#booking_dietary_restrictions}}

DIETARY REQUIREMENTS:
{{booking_dietary_restrictions}}{{/booking_dietary_restrictions}}{{#booking_extra_requests}}

SPECIAL REQUESTS:
{{booking_extra_requests}}{{/booking_extra_requests}}

If you have any questions or need to make changes to your booking, please reply to this email and we''ll get back to you promptly.

Best regards,
The Team',
true,
(SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1));

-- Insert dietary request template
INSERT INTO public.email_templates (name, type, subject_template, content_template, is_default, created_by) VALUES 
('Dietary Requirements Request', 'dietary_request',
'Dietary Requirements - {{tour_name}}',
'Dear {{customer_first_name}} {{customer_last_name}},

We are finalizing arrangements for your upcoming tour and would like to confirm your dietary requirements.

TOUR DETAILS:
• Tour: {{tour_name}}
• Dates: {{tour_start_date}} - {{tour_end_date}}
• Passengers: {{booking_passenger_count}}{{#booking_passenger_2_name}}
  - {{booking_passenger_2_name}}{{/booking_passenger_2_name}}{{#booking_passenger_3_name}}
  - {{booking_passenger_3_name}}{{/booking_passenger_3_name}}

CURRENT DIETARY REQUIREMENTS:{{#booking_dietary_restrictions}}
{{booking_dietary_restrictions}}{{/booking_dietary_restrictions}}{{^booking_dietary_restrictions}}
None specified{{/booking_dietary_restrictions}}

Please reply to this email with any dietary requirements, allergies, or special meal requests for all passengers in your booking.

Best regards,
The Team',
true,
(SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1));