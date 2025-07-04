
-- Update RLS policy to allow booking agents to create and update activities
DROP POLICY IF EXISTS "Booking agents can view activities" ON public.activities;

-- Create new policy that allows booking agents to manage activities (not just view)
CREATE POLICY "Booking agents can manage activities" 
  ON public.activities 
  FOR ALL
  USING (has_role(auth.uid(), 'booking_agent'::app_role))
  WITH CHECK (has_role(auth.uid(), 'booking_agent'::app_role));
