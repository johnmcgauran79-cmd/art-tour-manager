-- Set replica identity to full for complete row data during updates (if not already set)
ALTER TABLE hotel_bookings REPLICA IDENTITY FULL;
ALTER TABLE activity_bookings REPLICA IDENTITY FULL;