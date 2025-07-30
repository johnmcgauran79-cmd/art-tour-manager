-- Enable real-time updates for remaining tables
ALTER TABLE hotel_bookings REPLICA IDENTITY FULL;
ALTER TABLE activity_bookings REPLICA IDENTITY FULL;
ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER TABLE hotels REPLICA IDENTITY FULL;
ALTER TABLE activities REPLICA IDENTITY FULL;

-- Add only the missing tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE hotel_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE hotels;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;