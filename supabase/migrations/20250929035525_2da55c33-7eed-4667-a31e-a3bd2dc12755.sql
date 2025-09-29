-- Allow all authenticated users to view customers, tours, and bookings
-- Update RLS policies to be less restrictive for viewing

-- Update customers table policies
DROP POLICY IF EXISTS "Authorized users can view all customers" ON customers;
DROP POLICY IF EXISTS "Booking agents can view customers with assigned bookings" ON customers;
DROP POLICY IF EXISTS "Managers can view all customers" ON customers;

CREATE POLICY "All authenticated users can view customers"
ON customers FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Update tours table policies  
DROP POLICY IF EXISTS "Booking agents can view tours" ON tours;
DROP POLICY IF EXISTS "Managers can view tours" ON tours;
DROP POLICY IF EXISTS "Admins can view tours" ON tours;

CREATE POLICY "All authenticated users can view tours"
ON tours FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Update bookings table policies
DROP POLICY IF EXISTS "Booking agents can view bookings" ON bookings;
DROP POLICY IF EXISTS "Managers can view bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view bookings" ON bookings;

CREATE POLICY "All authenticated users can view bookings"
ON bookings FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Keep existing role-based policies for INSERT, UPDATE, DELETE operations
-- Only viewing is now open to all authenticated users