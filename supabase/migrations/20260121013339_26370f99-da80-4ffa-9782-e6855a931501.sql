-- Add new fields to activities table
ALTER TABLE public.activities 
ADD COLUMN depart_for_activity time without time zone,
ADD COLUMN transport_mode text DEFAULT 'not_required';

-- Add a comment describing the transport_mode options
COMMENT ON COLUMN public.activities.transport_mode IS 'Options: not_required, walking, private_coach, shuttle_bus, taxi, ferry, train, other';