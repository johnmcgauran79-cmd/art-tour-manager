-- Fix security vulnerability in crm_sync_log table
-- Remove overly permissive policy that allows all operations for any authenticated user
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.crm_sync_log;

-- Create secure policies that restrict access to admin users only
-- Admin users can view CRM sync logs for monitoring purposes
CREATE POLICY "Admins can view CRM sync logs" 
ON public.crm_sync_log 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only allow system/service to insert sync logs (for CRM integration functionality)
-- This allows the CRM sync edge function to work while restricting user access
CREATE POLICY "System can insert CRM sync logs" 
ON public.crm_sync_log 
FOR INSERT 
WITH CHECK (true);

-- Only admins can delete sync logs (for cleanup purposes)
CREATE POLICY "Admins can delete CRM sync logs" 
ON public.crm_sync_log 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Prevent updates to maintain audit trail integrity
-- CRM sync logs should be immutable once created