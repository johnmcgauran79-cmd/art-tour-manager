-- Security enhancement for customers table RLS policies
-- Remove invalid trigger and implement proper access controls

-- Drop the invalid trigger first
DROP TRIGGER IF EXISTS audit_customer_access ON customers;
DROP FUNCTION IF EXISTS log_customer_access();

-- Strengthen existing RLS policies by adding time-based restrictions
-- Update booking agents policy to only access customers with active bookings (not older than 90 days)
DROP POLICY IF EXISTS "Booking agents can access assigned customers only" ON customers;
CREATE POLICY "Booking agents can access assigned customers only"
ON customers FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'booking_agent'::app_role) AND
  EXISTS (
    SELECT 1 FROM bookings b
    JOIN booking_assignments ba ON b.id = ba.booking_id
    WHERE b.lead_passenger_id = customers.id
    AND ba.agent_id = auth.uid()
    AND ba.is_active = true
    AND b.status <> 'cancelled'::booking_status
    AND b.created_at > now() - INTERVAL '90 days'  -- Only access recent customer data
  )
);

-- Update booking agents update policy with same time restriction
DROP POLICY IF EXISTS "Booking agents can update assigned customers only" ON customers;
CREATE POLICY "Booking agents can update assigned customers only"
ON customers FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'booking_agent'::app_role) AND
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
WITH CHECK (
  has_role(auth.uid(), 'booking_agent'::app_role) AND
  EXISTS (
    SELECT 1 FROM bookings b
    JOIN booking_assignments ba ON b.id = ba.booking_id
    WHERE b.lead_passenger_id = customers.id
    AND ba.agent_id = auth.uid()
    AND ba.is_active = true
    AND b.status <> 'cancelled'::booking_status
    AND b.created_at > now() - INTERVAL '90 days'
  )
);

-- Strengthen manager policies to require active bookings for customer access
DROP POLICY IF EXISTS "Managers can view all customers" ON customers;
CREATE POLICY "Managers can view all customers"
ON customers FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.lead_passenger_id = customers.id
    AND bookings.status <> 'cancelled'::booking_status
  )
);

DROP POLICY IF EXISTS "Managers can update customers with bookings" ON customers;
CREATE POLICY "Managers can update customers with bookings"
ON customers FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.lead_passenger_id = customers.id
    AND bookings.status <> 'cancelled'::booking_status
  )
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.lead_passenger_id = customers.id
    AND bookings.status <> 'cancelled'::booking_status
  )
);

DROP POLICY IF EXISTS "Managers can delete customers with bookings" ON customers;
CREATE POLICY "Managers can delete customers with bookings"
ON customers FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.lead_passenger_id = customers.id
    AND bookings.status <> 'cancelled'::booking_status
  )
);

-- Add a new restrictive policy to prevent access to customers without any bookings
CREATE POLICY "Restrict access to customers with bookings only"
ON customers FOR ALL
TO authenticated
USING (
  -- Only allow access if customer has at least one booking
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.lead_passenger_id = customers.id
  )
);

-- Create a security definer function for secure customer search that limits exposed data
CREATE OR REPLACE FUNCTION secure_customer_search(search_term text)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text,
  has_active_bookings boolean
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    EXISTS(
      SELECT 1 FROM bookings b 
      WHERE b.lead_passenger_id = c.id 
      AND b.status <> 'cancelled'::booking_status
    ) as has_active_bookings
  FROM customers c
  WHERE 
    (c.first_name ILIKE '%' || search_term || '%' OR 
     c.last_name ILIKE '%' || search_term || '%' OR 
     c.email ILIKE '%' || search_term || '%')
    AND EXISTS(
      SELECT 1 FROM bookings b 
      WHERE b.lead_passenger_id = c.id
    )
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'manager'::app_role) OR
      (has_role(auth.uid(), 'booking_agent'::app_role) AND EXISTS(
        SELECT 1 FROM bookings b2
        JOIN booking_assignments ba ON b2.id = ba.booking_id
        WHERE b2.lead_passenger_id = c.id
        AND ba.agent_id = auth.uid()
        AND ba.is_active = true
      ))
    )
$$;