
-- Ensure RLS is completely disabled on all tables
-- This should resolve the "new row violates row-level security policy" errors

ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_bookings DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might still be active
DROP POLICY IF EXISTS "Enable read access for all users" ON public.customers;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.customers;
DROP POLICY IF EXISTS "Enable update for all users" ON public.customers;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.customers;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.tours;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.tours;
DROP POLICY IF EXISTS "Enable update for all users" ON public.tours;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.tours;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.hotels;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.hotels;
DROP POLICY IF EXISTS "Enable update for all users" ON public.hotels;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.hotels;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.activities;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.activities;
DROP POLICY IF EXISTS "Enable update for all users" ON public.activities;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.activities;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.bookings;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.bookings;
DROP POLICY IF EXISTS "Enable update for all users" ON public.bookings;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.bookings;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.hotel_bookings;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.hotel_bookings;
DROP POLICY IF EXISTS "Enable update for all users" ON public.hotel_bookings;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.hotel_bookings;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.activity_bookings;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.activity_bookings;
DROP POLICY IF EXISTS "Enable update for all users" ON public.activity_bookings;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.activity_bookings;

-- Also drop any policies with different naming patterns
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.tours;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.hotels;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.activities;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.bookings;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.hotel_bookings;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.activity_bookings;
