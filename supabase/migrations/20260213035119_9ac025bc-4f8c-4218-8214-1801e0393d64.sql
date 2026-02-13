
-- Add pickup_location_required to tours
ALTER TABLE public.tours ADD COLUMN pickup_location_required boolean NOT NULL DEFAULT false;

-- Create tour_pickup_options table
CREATE TABLE public.tour_pickup_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  name text NOT NULL,
  pickup_time time WITHOUT TIME ZONE NULL,
  details text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add selected pickup option to bookings
ALTER TABLE public.bookings ADD COLUMN selected_pickup_option_id uuid NULL REFERENCES public.tour_pickup_options(id) ON DELETE SET NULL;

-- Enable RLS on tour_pickup_options
ALTER TABLE public.tour_pickup_options ENABLE ROW LEVEL SECURITY;

-- RLS policies for tour_pickup_options (same pattern as activities)
CREATE POLICY "Admins can manage tour pickup options"
  ON public.tour_pickup_options FOR ALL
  USING (check_user_role(auth.uid(), 'admin'::text))
  WITH CHECK (check_user_role(auth.uid(), 'admin'::text));

CREATE POLICY "Managers can manage tour pickup options"
  ON public.tour_pickup_options FOR ALL
  USING (check_user_role(auth.uid(), 'manager'::text))
  WITH CHECK (check_user_role(auth.uid(), 'manager'::text));

CREATE POLICY "Booking agents can manage tour pickup options"
  ON public.tour_pickup_options FOR ALL
  USING (check_user_role(auth.uid(), 'booking_agent'::text))
  WITH CHECK (check_user_role(auth.uid(), 'booking_agent'::text));

CREATE POLICY "Agents can view tour pickup options"
  ON public.tour_pickup_options FOR SELECT
  USING (check_user_role(auth.uid(), 'agent'::text));

CREATE POLICY "Hosts can view pickup options for their assigned tours"
  ON public.tour_pickup_options FOR SELECT
  USING (is_host_for_tour(auth.uid(), tour_id));

-- Public can view pickup options (needed for customer-facing selection page)
CREATE POLICY "Public can view tour pickup options"
  ON public.tour_pickup_options FOR SELECT
  USING (true);

-- Index for performance
CREATE INDEX idx_tour_pickup_options_tour_id ON public.tour_pickup_options(tour_id);
CREATE INDEX idx_bookings_selected_pickup ON public.bookings(selected_pickup_option_id);
