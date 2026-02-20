
-- Create activity_journeys table for multi-stop transport
CREATE TABLE public.activity_journeys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  journey_number INTEGER NOT NULL CHECK (journey_number >= 1 AND journey_number <= 7),
  pickup_time TIME WITHOUT TIME ZONE,
  pickup_location TEXT,
  destination TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(activity_id, journey_number)
);

-- Enable RLS
ALTER TABLE public.activity_journeys ENABLE ROW LEVEL SECURITY;

-- RLS policies matching activities table pattern
CREATE POLICY "Admins can manage all activity journeys"
  ON public.activity_journeys FOR ALL
  USING (check_user_role(auth.uid(), 'admin'))
  WITH CHECK (check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can manage all activity journeys"
  ON public.activity_journeys FOR ALL
  USING (check_user_role(auth.uid(), 'manager'))
  WITH CHECK (check_user_role(auth.uid(), 'manager'));

CREATE POLICY "Booking agents can manage activity journeys"
  ON public.activity_journeys FOR ALL
  USING (check_user_role(auth.uid(), 'booking_agent'))
  WITH CHECK (check_user_role(auth.uid(), 'booking_agent'));

CREATE POLICY "Agents can view activity journeys"
  ON public.activity_journeys FOR SELECT
  USING (check_user_role(auth.uid(), 'agent'));

CREATE POLICY "Hosts can view activity journeys for their assigned tours"
  ON public.activity_journeys FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM activities a
    WHERE a.id = activity_journeys.activity_id
    AND is_host_for_tour(auth.uid(), a.tour_id)
  ));

-- Migrate existing pickup/collection data into Journey 1
INSERT INTO public.activity_journeys (activity_id, journey_number, pickup_time, pickup_location, destination, sort_order)
SELECT id, 1, pickup_time, pickup_location, dropoff_location, 0
FROM public.activities
WHERE pickup_time IS NOT NULL OR pickup_location IS NOT NULL OR dropoff_location IS NOT NULL;

-- Migrate collection data into Journey 2 (return journey)
INSERT INTO public.activity_journeys (activity_id, journey_number, pickup_time, pickup_location, destination, sort_order)
SELECT id, 2, collection_time, collection_location, NULL, 1
FROM public.activities
WHERE collection_time IS NOT NULL OR collection_location IS NOT NULL;

-- Now remove the old single pickup/collection columns from activities
ALTER TABLE public.activities DROP COLUMN IF EXISTS pickup_time;
ALTER TABLE public.activities DROP COLUMN IF EXISTS pickup_location;
ALTER TABLE public.activities DROP COLUMN IF EXISTS collection_time;
ALTER TABLE public.activities DROP COLUMN IF EXISTS collection_location;
ALTER TABLE public.activities DROP COLUMN IF EXISTS dropoff_location;
