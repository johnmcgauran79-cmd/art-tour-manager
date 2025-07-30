-- Enable realtime for all notification-related tables
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE hotel_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE tours;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE hotels;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;

-- Set replica identity to full for complete row data during updates
ALTER TABLE bookings REPLICA IDENTITY FULL;
ALTER TABLE hotel_bookings REPLICA IDENTITY FULL;
ALTER TABLE activity_bookings REPLICA IDENTITY FULL;
ALTER TABLE tours REPLICA IDENTITY FULL;
ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER TABLE hotels REPLICA IDENTITY FULL;
ALTER TABLE activities REPLICA IDENTITY FULL;