-- Enable realtime for notification-related tables
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.tours REPLICA IDENTITY FULL;
ALTER TABLE public.hotels REPLICA IDENTITY FULL;
ALTER TABLE public.activities REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.task_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.user_notifications REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tours;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hotels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;