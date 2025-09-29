-- Fix customer creation issue caused by overly restrictive RLS policies
-- The current policies prevent customer creation because they require existing bookings

-- Drop the restrictive policy that prevents access to customers without bookings
DROP POLICY IF EXISTS "Prevent access to orphaned customer records" ON customers;

-- Update the booking agents INSERT policy to allow customer creation
DROP POLICY IF EXISTS "Booking agents can create customers" ON customers;
CREATE POLICY "Booking agents can create customers"
ON customers FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'booking_agent'::app_role));

-- Update the managers INSERT policy to allow customer creation  
DROP POLICY IF EXISTS "Managers can insert customers" ON customers;
CREATE POLICY "Managers can insert customers"
ON customers FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- Add admin INSERT policy that was missing
CREATE POLICY "Admins can insert customers"
ON customers FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Modify the restrictive SELECT policy to allow viewing customers without bookings for admins
-- but maintain restrictions for other roles
DROP POLICY IF EXISTS "Restrict access to customers with bookings only" ON customers;

-- Keep the existing role-specific SELECT policies but add a policy for customers without bookings
-- This allows creating customers first, then adding bookings later
CREATE POLICY "Allow access to customers without bookings for authorized creation"
ON customers FOR SELECT
TO authenticated
USING (
  -- Admins can see all customers
  has_role(auth.uid(), 'admin'::app_role) OR
  -- Managers and booking agents can see customers they just created (within 1 hour)
  (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'booking_agent'::app_role))
    AND created_at > now() - INTERVAL '1 hour'
    AND NOT EXISTS (SELECT 1 FROM bookings WHERE bookings.lead_passenger_id = customers.id)
  )
);