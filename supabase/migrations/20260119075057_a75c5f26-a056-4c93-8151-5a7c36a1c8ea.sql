-- Update all tours without a final_payment_date to 90 days before start_date
UPDATE public.tours 
SET final_payment_date = start_date - INTERVAL '90 days'
WHERE final_payment_date IS NULL;