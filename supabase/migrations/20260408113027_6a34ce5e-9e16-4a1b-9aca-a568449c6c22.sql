CREATE POLICY "Staff can update acknowledgments"
ON public.activity_discrepancy_acknowledgments
FOR UPDATE
TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
)
WITH CHECK (
  (auth.uid() = acknowledged_by) AND (
    check_user_role(auth.uid(), 'admin') OR 
    check_user_role(auth.uid(), 'manager') OR 
    check_user_role(auth.uid(), 'booking_agent')
  )
);

CREATE POLICY "Hosts can update acknowledgments for assigned tours"
ON public.activity_discrepancy_acknowledgments
FOR UPDATE
TO authenticated
USING (is_host_for_tour(auth.uid(), tour_id))
WITH CHECK (
  (auth.uid() = acknowledged_by) AND is_host_for_tour(auth.uid(), tour_id)
);