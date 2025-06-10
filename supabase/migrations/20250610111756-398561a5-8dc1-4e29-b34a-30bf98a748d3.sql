
-- Disable RLS on activity_bookings table to match other tables
ALTER TABLE activity_bookings DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies on activity_bookings
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON activity_bookings;
