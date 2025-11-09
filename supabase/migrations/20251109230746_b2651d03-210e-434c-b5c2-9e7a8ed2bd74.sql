-- Add RLS policies for agents to view bookings and related data (read-only)

-- Agents can view all bookings (read-only)
CREATE POLICY "Agents can view all bookings"
ON bookings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'agent'));

-- Agents can view all customers (read-only)
CREATE POLICY "Agents can view all customers"
ON customers
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'agent'));

-- Agents can view tours (read-only)
CREATE POLICY "Agents can view tours"
ON tours
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'agent'));