
-- Table to store acknowledgments of activity discrepancies
-- Stores snapshot of passenger_count and allocated_count so we can detect changes
CREATE TABLE public.activity_discrepancy_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  activity_id uuid NOT NULL,
  tour_id uuid NOT NULL,
  acknowledged_by uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  snapshot_passenger_count integer NOT NULL,
  snapshot_allocated_count integer NOT NULL,
  discrepancy_type text NOT NULL,
  UNIQUE (booking_id, activity_id)
);

-- Enable RLS
ALTER TABLE public.activity_discrepancy_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Policies: staff can manage acknowledgments
CREATE POLICY "Staff can view acknowledgments"
ON public.activity_discrepancy_acknowledgments
FOR SELECT
TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
);

CREATE POLICY "Staff can create acknowledgments"
ON public.activity_discrepancy_acknowledgments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = acknowledged_by AND (
    check_user_role(auth.uid(), 'admin') OR 
    check_user_role(auth.uid(), 'manager') OR 
    check_user_role(auth.uid(), 'booking_agent')
  )
);

CREATE POLICY "Staff can delete acknowledgments"
ON public.activity_discrepancy_acknowledgments
FOR DELETE
TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
);

-- Hosts can view acknowledgments for their tours
CREATE POLICY "Hosts can view acknowledgments for assigned tours"
ON public.activity_discrepancy_acknowledgments
FOR SELECT
TO public
USING (is_host_for_tour(auth.uid(), tour_id));

CREATE POLICY "Hosts can create acknowledgments for assigned tours"
ON public.activity_discrepancy_acknowledgments
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = acknowledged_by AND is_host_for_tour(auth.uid(), tour_id)
);

-- Index for fast lookups
CREATE INDEX idx_discrepancy_ack_booking_activity 
ON public.activity_discrepancy_acknowledgments (booking_id, activity_id);

CREATE INDEX idx_discrepancy_ack_tour 
ON public.activity_discrepancy_acknowledgments (tour_id);
