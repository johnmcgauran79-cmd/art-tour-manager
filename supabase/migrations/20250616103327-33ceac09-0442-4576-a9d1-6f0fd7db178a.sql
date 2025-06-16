
-- Phase 1: Enable RLS and Create Basic Policies

-- First, enable RLS on all core business tables
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_bookings ENABLE ROW LEVEL SECURITY;

-- Create comprehensive role-based access policies for TOURS
-- Admins: Full access to all tours
CREATE POLICY "Admins can manage all tours"
  ON public.tours
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Managers: Full access to all tours
CREATE POLICY "Managers can manage all tours"
  ON public.tours
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- Booking Agents: Read-only access to tours
CREATE POLICY "Booking agents can view tours"
  ON public.tours
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'booking_agent'));

-- Create comprehensive role-based access policies for ACTIVITIES
-- Admins: Full access to all activities
CREATE POLICY "Admins can manage all activities"
  ON public.activities
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Managers: Full access to all activities
CREATE POLICY "Managers can manage all activities"
  ON public.activities
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- Booking Agents: Read-only access to activities
CREATE POLICY "Booking agents can view activities"
  ON public.activities
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'booking_agent'));

-- Create comprehensive role-based access policies for HOTELS
-- Admins: Full access to all hotels
CREATE POLICY "Admins can manage all hotels"
  ON public.hotels
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Managers: Full access to all hotels
CREATE POLICY "Managers can manage all hotels"
  ON public.hotels
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- Booking Agents: Read-only access to hotels
CREATE POLICY "Booking agents can view hotels"
  ON public.hotels
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'booking_agent'));

-- Create comprehensive role-based access policies for BOOKINGS
-- Admins: Full access to all bookings
CREATE POLICY "Admins can manage all bookings"
  ON public.bookings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Managers: Full access to all bookings
CREATE POLICY "Managers can manage all bookings"
  ON public.bookings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- Booking Agents: Full access to bookings (they need to create and manage bookings)
CREATE POLICY "Booking agents can manage bookings"
  ON public.bookings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'booking_agent'))
  WITH CHECK (public.has_role(auth.uid(), 'booking_agent'));

-- Create comprehensive role-based access policies for CUSTOMERS
-- Admins: Full access to all customers
CREATE POLICY "Admins can manage all customers"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Managers: Full access to all customers
CREATE POLICY "Managers can manage all customers"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- Booking Agents: Full access to customers (they need to create and manage customer records)
CREATE POLICY "Booking agents can manage customers"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'booking_agent'))
  WITH CHECK (public.has_role(auth.uid(), 'booking_agent'));

-- Create comprehensive role-based access policies for ACTIVITY_BOOKINGS
-- Admins: Full access to all activity bookings
CREATE POLICY "Admins can manage all activity bookings"
  ON public.activity_bookings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Managers: Full access to all activity bookings
CREATE POLICY "Managers can manage all activity bookings"
  ON public.activity_bookings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- Booking Agents: Full access to activity bookings
CREATE POLICY "Booking agents can manage activity bookings"
  ON public.activity_bookings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'booking_agent'))
  WITH CHECK (public.has_role(auth.uid(), 'booking_agent'));

-- Create comprehensive role-based access policies for HOTEL_BOOKINGS
-- Admins: Full access to all hotel bookings
CREATE POLICY "Admins can manage all hotel bookings"
  ON public.hotel_bookings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Managers: Full access to all hotel bookings
CREATE POLICY "Managers can manage all hotel bookings"
  ON public.hotel_bookings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- Booking Agents: Full access to hotel bookings
CREATE POLICY "Booking agents can manage hotel bookings"
  ON public.hotel_bookings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'booking_agent'))
  WITH CHECK (public.has_role(auth.uid(), 'booking_agent'));

-- Add audit logging function for sensitive operations
CREATE OR REPLACE FUNCTION public.log_sensitive_operation(
  operation_type TEXT,
  table_name TEXT,
  record_id UUID,
  details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_log (
    user_id,
    operation_type,
    table_name,
    record_id,
    details,
    timestamp
  ) VALUES (
    auth.uid(),
    operation_type,
    table_name,
    record_id,
    details,
    now()
  );
END;
$$;

-- Create audit log table for tracking sensitive operations
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  operation_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- System can insert audit logs (security definer functions)
CREATE POLICY "System can insert audit logs"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
