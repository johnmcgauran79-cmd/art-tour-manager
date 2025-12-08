-- Add emergency contact and medical fields to customers table
ALTER TABLE public.customers
ADD COLUMN emergency_contact_name text,
ADD COLUMN emergency_contact_phone text,
ADD COLUMN emergency_contact_relationship text,
ADD COLUMN medical_conditions text,
ADD COLUMN accessibility_needs text;