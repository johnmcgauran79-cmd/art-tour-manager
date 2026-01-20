-- Add emergency_contact_email column to customers table
ALTER TABLE public.customers 
ADD COLUMN emergency_contact_email text;