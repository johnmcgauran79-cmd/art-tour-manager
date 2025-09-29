-- Allow viewing customers without bookings while maintaining role-based access
-- Remove the restrictive booking requirement from SELECT policies

-- Drop the restrictive policy that requires customers to have bookings for viewing
DROP POLICY IF EXISTS "Allow access to customers without bookings for authorized creation" ON customers;

-- Update existing role-specific SELECT policies to not require bookings
-- Keep the booking agents policy for assigned customers but add a general view policy

-- Allow all authorized roles to view all customers (without booking requirement)
CREATE POLICY "Authorized users can view all customers"
ON customers FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'booking_agent'::app_role)
);

-- Keep the more restrictive UPDATE and DELETE policies for customers with bookings
-- but allow admins to update/delete any customer
DROP POLICY IF EXISTS "Booking agents can update assigned customers only" ON customers;
CREATE POLICY "Booking agents can update assigned customers only"
ON customers FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'booking_agent'::app_role) AND
  (
    -- Allow editing customers without bookings (newly created)
    NOT EXISTS (SELECT 1 FROM bookings WHERE bookings.lead_passenger_id = customers.id) OR
    -- Or customers with assigned bookings (existing logic)
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN booking_assignments ba ON b.id = ba.booking_id
      WHERE b.lead_passenger_id = customers.id
      AND ba.agent_id = auth.uid()
      AND ba.is_active = true
      AND b.status <> 'cancelled'::booking_status
      AND b.created_at > now() - INTERVAL '90 days'
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'booking_agent'::app_role)
);

-- Update managers policy to allow viewing/updating all customers
DROP POLICY IF EXISTS "Managers can view all customers" ON customers;
DROP POLICY IF EXISTS "Managers can update customers with bookings" ON customers;
DROP POLICY IF EXISTS "Managers can delete customers with bookings" ON customers;

CREATE POLICY "Managers can view all customers"
ON customers FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can update all customers"
ON customers FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can delete customers"
ON customers FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

-- Clean up any duplicate policies that might interfere
DROP POLICY IF EXISTS "Restrict access to customers with bookings only" ON customers;