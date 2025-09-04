-- Add RLS policies for capacity_monitoring_rules table
-- This table should only be accessible to admins and managers

-- Allow admins to manage all capacity monitoring rules
CREATE POLICY "Admins can manage capacity monitoring rules" 
ON public.capacity_monitoring_rules 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow managers to view capacity monitoring rules
CREATE POLICY "Managers can view capacity monitoring rules" 
ON public.capacity_monitoring_rules 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));