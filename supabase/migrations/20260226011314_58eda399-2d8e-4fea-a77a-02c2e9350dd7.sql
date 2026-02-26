
-- Drop the existing host update policy on customers
DROP POLICY IF EXISTS "Hosts can update customers for their assigned tours" ON public.customers;

-- Recreate with coverage for all passenger slots (lead, secondary, pax2, pax3)
CREATE POLICY "Hosts can update customers for their assigned tours"
ON public.customers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM bookings b
    WHERE (
      b.lead_passenger_id = customers.id
      OR b.secondary_contact_id = customers.id
      OR b.passenger_2_id = customers.id
      OR b.passenger_3_id = customers.id
    )
    AND is_host_for_tour(auth.uid(), b.tour_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bookings b
    WHERE (
      b.lead_passenger_id = customers.id
      OR b.secondary_contact_id = customers.id
      OR b.passenger_2_id = customers.id
      OR b.passenger_3_id = customers.id
    )
    AND is_host_for_tour(auth.uid(), b.tour_id)
  )
);

-- Also update the host SELECT policy to cover all passenger slots
DROP POLICY IF EXISTS "Hosts can view customers for their assigned tour bookings" ON public.customers;

CREATE POLICY "Hosts can view customers for their assigned tour bookings"
ON public.customers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bookings b
    WHERE (
      b.lead_passenger_id = customers.id
      OR b.secondary_contact_id = customers.id
      OR b.passenger_2_id = customers.id
      OR b.passenger_3_id = customers.id
    )
    AND is_host_for_tour(auth.uid(), b.tour_id)
  )
);
