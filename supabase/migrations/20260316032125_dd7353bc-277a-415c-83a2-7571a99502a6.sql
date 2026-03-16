-- Allow hosts to update ONLY the tour_hosts_notes column on their assigned tours
CREATE POLICY "Hosts can update tour_hosts_notes on assigned tours"
ON public.tours
FOR UPDATE
TO authenticated
USING (is_host_for_tour(auth.uid(), id))
WITH CHECK (is_host_for_tour(auth.uid(), id));