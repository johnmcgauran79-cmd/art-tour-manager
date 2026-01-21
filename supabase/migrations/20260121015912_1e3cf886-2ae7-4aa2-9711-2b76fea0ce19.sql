-- Add driver contact fields to activities table
ALTER TABLE public.activities
ADD COLUMN driver_name text NULL,
ADD COLUMN driver_phone text NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.activities.driver_name IS 'Name of the transport driver';
COMMENT ON COLUMN public.activities.driver_phone IS 'Phone number of the transport driver';