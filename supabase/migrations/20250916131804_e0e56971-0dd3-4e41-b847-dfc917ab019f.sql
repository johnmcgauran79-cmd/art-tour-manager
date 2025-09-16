-- Security Enhancement: Implement stricter customer data access controls
-- This addresses the security finding about customer personal information exposure

-- 1. Create a booking assignments table to track which agents handle which bookings
CREATE TABLE IF NOT EXISTS public.booking_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL,
    assigned_by UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(booking_id, agent_id)
);

-- Enable RLS on booking assignments
ALTER TABLE public.booking_assignments ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS policies for booking assignments
CREATE POLICY "Agents can view their own assignments" 
ON public.booking_assignments 
FOR SELECT 
USING (auth.uid() = agent_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers and admins can create assignments" 
ON public.booking_assignments 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers and admins can update assignments" 
ON public.booking_assignments 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers and admins can delete assignments" 
ON public.booking_assignments 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- 3. Create a security function to check if an agent is assigned to a specific booking
CREATE OR REPLACE FUNCTION public.agent_assigned_to_booking(_agent_id uuid, _booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_assignments 
    WHERE agent_id = _agent_id 
    AND booking_id = _booking_id 
    AND is_active = true
  )
$$;

-- 4. Update customers table RLS policies with stricter access controls
DROP POLICY IF EXISTS "Booking agents can access customers with active bookings" ON public.customers;
DROP POLICY IF EXISTS "Booking agents can update customers with active bookings" ON public.customers;

-- New policy: Booking agents can only access customers for bookings they are assigned to
CREATE POLICY "Booking agents can access assigned customers only" 
ON public.customers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'booking_agent'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.booking_assignments ba ON b.id = ba.booking_id
    WHERE b.lead_passenger_id = customers.id 
    AND ba.agent_id = auth.uid()
    AND ba.is_active = true
    AND b.status <> 'cancelled'::booking_status
  )
);

-- New policy: Booking agents can only update customers for bookings they are assigned to
CREATE POLICY "Booking agents can update assigned customers only" 
ON public.customers 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'booking_agent'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.booking_assignments ba ON b.id = ba.booking_id
    WHERE b.lead_passenger_id = customers.id 
    AND ba.agent_id = auth.uid()
    AND ba.is_active = true
    AND b.status <> 'cancelled'::booking_status
  )
)
WITH CHECK (
  has_role(auth.uid(), 'booking_agent'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.booking_assignments ba ON b.id = ba.booking_id
    WHERE b.lead_passenger_id = customers.id 
    AND ba.agent_id = auth.uid()
    AND ba.is_active = true
    AND b.status <> 'cancelled'::booking_status
  )
);

-- Keep existing policies for managers and admins unchanged
-- (They already have full access which is appropriate for their roles)

-- 5. Create a function to automatically assign booking agents when they create bookings
CREATE OR REPLACE FUNCTION public.auto_assign_booking_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role app_role;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role 
  FROM user_roles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  -- If the booking was created by a booking agent, auto-assign them
  IF current_user_role = 'booking_agent' THEN
    INSERT INTO public.booking_assignments (booking_id, agent_id, assigned_by)
    VALUES (NEW.id, auth.uid(), auth.uid())
    ON CONFLICT (booking_id, agent_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Create trigger for auto-assignment
DROP TRIGGER IF EXISTS auto_assign_booking_agent_trigger ON public.bookings;
CREATE TRIGGER auto_assign_booking_agent_trigger
    AFTER INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_assign_booking_agent();

-- 7. Populate existing booking assignments for all current bookings
-- Assign all booking agents to all existing active bookings (maintaining current access)
-- This ensures no disruption to existing workflows
INSERT INTO public.booking_assignments (booking_id, agent_id, assigned_by)
SELECT DISTINCT 
    b.id as booking_id,
    ur.user_id as agent_id,
    (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1) as assigned_by
FROM public.bookings b
CROSS JOIN public.user_roles ur
WHERE ur.role = 'booking_agent'
AND b.status <> 'cancelled'
ON CONFLICT (booking_id, agent_id) DO NOTHING;

-- 8. Log this security enhancement
INSERT INTO public.audit_log (user_id, operation_type, table_name, record_id, details)
VALUES (
  COALESCE(auth.uid(), (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1)),
  'SECURITY_ENHANCEMENT',
  'customers',
  null,
  jsonb_build_object(
    'enhancement', 'customer_data_access_controls',
    'description', 'Implemented booking assignment system for stricter customer data access',
    'impact', 'Booking agents now only access customers for assigned bookings'
  )
);