
-- Add form_id column to customer_access_tokens to track which custom form a token is for
ALTER TABLE public.customer_access_tokens 
ADD COLUMN form_id uuid REFERENCES public.tour_custom_forms(id) ON DELETE SET NULL;

-- Remove the implicit one-form-per-tour constraint by allowing multiple published forms
-- (No constraint to remove - the current code just used .single() queries)
