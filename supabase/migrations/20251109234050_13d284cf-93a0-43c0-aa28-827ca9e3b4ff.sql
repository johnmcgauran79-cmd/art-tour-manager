-- Add SELECT-only policies for agents to view hotels, activities, and related bookings

-- Hotels
CREATE POLICY "Agents can view hotels"
ON public.hotels
FOR SELECT
TO authenticated
USING (check_user_role(auth.uid(), 'agent'));

-- Activities
CREATE POLICY "Agents can view activities"
ON public.activities
FOR SELECT
TO authenticated
USING (check_user_role(auth.uid(), 'agent'));

-- Hotel Bookings
CREATE POLICY "Agents can view hotel bookings"
ON public.hotel_bookings
FOR SELECT
TO authenticated
USING (check_user_role(auth.uid(), 'agent'));

-- Activity Bookings
CREATE POLICY "Agents can view activity bookings"
ON public.activity_bookings
FOR SELECT
TO authenticated
USING (check_user_role(auth.uid(), 'agent'));