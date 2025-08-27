-- Fix security vulnerability in tour_attachments table
-- Replace the overly permissive SELECT policy with proper role-based access control

DROP POLICY "Users can view tour attachments" ON public.tour_attachments;

-- Create proper role-based access policy for viewing tour attachments
CREATE POLICY "Only authorized users can view tour attachments" 
ON public.tour_attachments 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'booking_agent'::app_role)
);