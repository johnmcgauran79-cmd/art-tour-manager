-- Step 2: Create tour_host_assignments table to link hosts to specific tours
CREATE TABLE public.tour_host_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    host_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by uuid NOT NULL REFERENCES auth.users(id),
    assigned_at timestamp with time zone NOT NULL DEFAULT now(),
    notes text,
    UNIQUE (tour_id, host_user_id)
);

-- Enable RLS
ALTER TABLE public.tour_host_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tour_host_assignments
CREATE POLICY "Admins and managers can manage host assignments"
ON public.tour_host_assignments
FOR ALL
USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager'))
WITH CHECK (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager'));

CREATE POLICY "Hosts can view their own assignments"
ON public.tour_host_assignments
FOR SELECT
USING (auth.uid() = host_user_id);

-- Step 3: Create helper function to check if user is host for a specific tour
CREATE OR REPLACE FUNCTION public.is_host_for_tour(_user_id uuid, _tour_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tour_host_assignments tha
    INNER JOIN public.user_roles ur ON ur.user_id = tha.host_user_id
    WHERE tha.host_user_id = _user_id
      AND tha.tour_id = _tour_id
      AND ur.role = 'host'
  )
$$;

-- Step 4: Add host SELECT policies to tours table
CREATE POLICY "Hosts can view their assigned tours"
ON public.tours
FOR SELECT
USING (is_host_for_tour(auth.uid(), id));

-- Step 5: Add host SELECT policies to bookings (for tours they're assigned to)
CREATE POLICY "Hosts can view bookings for their assigned tours"
ON public.bookings
FOR SELECT
USING (is_host_for_tour(auth.uid(), tour_id));

-- Step 6: Add host SELECT policies to hotels
CREATE POLICY "Hosts can view hotels for their assigned tours"
ON public.hotels
FOR SELECT
USING (is_host_for_tour(auth.uid(), tour_id));

-- Step 7: Add host SELECT policies to hotel_bookings
CREATE POLICY "Hosts can view hotel bookings for their assigned tours"
ON public.hotel_bookings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = hotel_bookings.booking_id
    AND is_host_for_tour(auth.uid(), b.tour_id)
  )
);

-- Step 8: Add host SELECT policies to activities
CREATE POLICY "Hosts can view activities for their assigned tours"
ON public.activities
FOR SELECT
USING (is_host_for_tour(auth.uid(), tour_id));

-- Step 9: Add host SELECT policies to activity_bookings
CREATE POLICY "Hosts can view activity bookings for their assigned tours"
ON public.activity_bookings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.id = activity_bookings.activity_id
    AND is_host_for_tour(auth.uid(), a.tour_id)
  )
);

-- Step 10: Add host SELECT policies to customers (for viewing passenger info)
CREATE POLICY "Hosts can view customers for their assigned tour bookings"
ON public.customers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE (b.lead_passenger_id = customers.id OR b.secondary_contact_id = customers.id)
    AND is_host_for_tour(auth.uid(), b.tour_id)
  )
);

-- Step 11: Add host SELECT policies to tasks (view only for their tours)
CREATE POLICY "Hosts can view tasks for their assigned tours"
ON public.tasks
FOR SELECT
USING (is_host_for_tour(auth.uid(), tour_id));

-- Step 12: Add host SELECT policies to tour_itineraries
CREATE POLICY "Hosts can view itineraries for their assigned tours"
ON public.tour_itineraries
FOR SELECT
USING (is_host_for_tour(auth.uid(), tour_id));

-- Step 13: Add host SELECT policies to tour_external_links
CREATE POLICY "Hosts can view external links for their assigned tours"
ON public.tour_external_links
FOR SELECT
USING (is_host_for_tour(auth.uid(), tour_id));

-- Step 14: Add host SELECT policies to tour_attachments
CREATE POLICY "Hosts can view attachments for their assigned tours"
ON public.tour_attachments
FOR SELECT
USING (is_host_for_tour(auth.uid(), tour_id));

-- Step 15: Add host SELECT policies to activity_attachments  
CREATE POLICY "Hosts can view activity attachments for their assigned tours"
ON public.activity_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.id = activity_attachments.activity_id
    AND is_host_for_tour(auth.uid(), a.tour_id)
  )
);

-- Step 16: Add host SELECT policy for tour_itinerary_days
CREATE POLICY "Hosts can view itinerary days for their assigned tours"
ON public.tour_itinerary_days
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tour_itineraries ti
    WHERE ti.id = tour_itinerary_days.itinerary_id
    AND is_host_for_tour(auth.uid(), ti.tour_id)
  )
);

-- Step 17: Add host SELECT policy for tour_itinerary_entries
CREATE POLICY "Hosts can view itinerary entries for their assigned tours"
ON public.tour_itinerary_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tour_itinerary_days tid
    JOIN public.tour_itineraries ti ON ti.id = tid.itinerary_id
    WHERE tid.id = tour_itinerary_entries.day_id
    AND is_host_for_tour(auth.uid(), ti.tour_id)
  )
);