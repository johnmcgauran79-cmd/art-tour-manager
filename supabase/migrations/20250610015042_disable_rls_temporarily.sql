
-- Temporarily disable RLS on all tables to allow testing without authentication
-- This should be re-enabled once authentication is implemented

ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE tours DISABLE ROW LEVEL SECURITY;
ALTER TABLE hotels DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_bookings DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON customers;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON tours;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON hotels;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON activities;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON bookings;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON hotel_bookings;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON activity_bookings;
