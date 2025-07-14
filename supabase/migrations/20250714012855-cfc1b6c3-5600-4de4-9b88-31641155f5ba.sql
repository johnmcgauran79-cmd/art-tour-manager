-- Enable realtime for the bookings table
ALTER TABLE public.bookings REPLICA IDENTITY FULL;

-- Add bookings table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;