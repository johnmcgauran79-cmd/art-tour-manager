-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users with tour access can manage itineraries" ON public.tour_itineraries;

-- Recreate with less restrictive WITH CHECK for updates (admins/managers can update any itinerary)
CREATE POLICY "Staff can manage itineraries"
ON public.tour_itineraries
FOR ALL
TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
)
WITH CHECK (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
);