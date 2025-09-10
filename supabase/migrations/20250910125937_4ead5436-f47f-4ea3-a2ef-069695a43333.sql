-- Drop existing overly permissive policies for customers table
DROP POLICY IF EXISTS "Booking agents can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Managers can manage all customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can manage all customers" ON public.customers;

-- Create new, more secure policies

-- Admins can still manage all customers (needed for system administration)
CREATE POLICY "Admins can manage all customers" 
ON public.customers 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Managers can view all customers
CREATE POLICY "Managers can view all customers" 
ON public.customers 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role));

-- Managers can insert customers
CREATE POLICY "Managers can insert customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- Managers can update customers with bookings
CREATE POLICY "Managers can update customers with bookings" 
ON public.customers 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE lead_passenger_id = customers.id 
    AND status != 'cancelled'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE lead_passenger_id = customers.id 
    AND status != 'cancelled'
  )
);

-- Managers can delete customers with bookings
CREATE POLICY "Managers can delete customers with bookings" 
ON public.customers 
FOR DELETE 
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE lead_passenger_id = customers.id 
    AND status != 'cancelled'
  )
);

-- Booking agents can only access customers who have active bookings (not cancelled)
CREATE POLICY "Booking agents can access customers with active bookings" 
ON public.customers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'booking_agent'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE lead_passenger_id = customers.id 
    AND status != 'cancelled'
  )
);

-- Booking agents can create new customers (needed for new bookings)
CREATE POLICY "Booking agents can create customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'booking_agent'::app_role));

-- Booking agents can update customers with active bookings
CREATE POLICY "Booking agents can update customers with active bookings" 
ON public.customers 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'booking_agent'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE lead_passenger_id = customers.id 
    AND status != 'cancelled'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'booking_agent'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE lead_passenger_id = customers.id 
    AND status != 'cancelled'
  )
);