-- Fix security vulnerability in booking_comments table
-- Replace the overly permissive SELECT policy with proper role-based access control

DROP POLICY "Users can view booking comments" ON public.booking_comments;
DROP POLICY "Users can create booking comments" ON public.booking_comments;

-- Create proper role-based access policies
CREATE POLICY "Only authorized users can view booking comments" 
ON public.booking_comments 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'booking_agent'::app_role)
);

CREATE POLICY "Only authorized users can create booking comments" 
ON public.booking_comments 
FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'manager'::app_role) OR 
   has_role(auth.uid(), 'booking_agent'::app_role)) AND
  auth.uid() = user_id
);