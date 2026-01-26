-- Allow hosts to update customers (specifically for avatar uploads) for bookings on their assigned tours
CREATE POLICY "Hosts can update customers for their assigned tours"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  public.is_host_for_tour(auth.uid(), (
    SELECT b.tour_id FROM public.bookings b 
    WHERE b.lead_passenger_id = customers.id 
       OR b.secondary_contact_id = customers.id
    LIMIT 1
  ))
)
WITH CHECK (
  public.is_host_for_tour(auth.uid(), (
    SELECT b.tour_id FROM public.bookings b 
    WHERE b.lead_passenger_id = customers.id 
       OR b.secondary_contact_id = customers.id
    LIMIT 1
  ))
);