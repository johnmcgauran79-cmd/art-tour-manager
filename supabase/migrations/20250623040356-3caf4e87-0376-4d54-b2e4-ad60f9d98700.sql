
-- Create automated tour operations task templates
INSERT INTO public.task_templates (name, description, category, priority, days_before_tour, is_active) VALUES
('Final Payment Reminder', 'Send final payment reminders to all passengers', 'finance', 'high', 30, true),
('Hotel Booking Confirmation', 'Confirm all hotel bookings and room allocations', 'operations', 'critical', 21, true),
('Activity Booking Confirmation', 'Confirm all activity bookings and capacity', 'operations', 'high', 14, true),
('Travel Document Check', 'Verify all passenger travel documents', 'operations', 'critical', 14, true),
('Emergency Contact Collection', 'Collect emergency contacts from all passengers', 'operations', 'medium', 10, true),
('Final Passenger List', 'Generate and distribute final passenger list', 'operations', 'high', 7, true),
('Tour Guide Briefing', 'Brief tour guide on itinerary and passenger needs', 'operations', 'high', 3, true),
('Welcome Package Preparation', 'Prepare welcome packages and tour materials', 'operations', 'medium', 2, true);
