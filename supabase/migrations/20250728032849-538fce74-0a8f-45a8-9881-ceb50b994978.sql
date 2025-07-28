-- Add missing tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hotels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;