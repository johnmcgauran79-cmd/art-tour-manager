-- Remove unused medical/emergency columns from bookings table
-- This data is stored on the customers (contacts) table instead

ALTER TABLE public.bookings
DROP COLUMN IF EXISTS dietary_restrictions,
DROP COLUMN IF EXISTS medical_conditions,
DROP COLUMN IF EXISTS accessibility_needs,
DROP COLUMN IF EXISTS emergency_contact_name,
DROP COLUMN IF EXISTS emergency_contact_phone,
DROP COLUMN IF EXISTS emergency_contact_relationship;