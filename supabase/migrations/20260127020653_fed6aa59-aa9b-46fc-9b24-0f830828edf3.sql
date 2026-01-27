-- Update the default expiry for customer access tokens from 24 hours to 72 hours
ALTER TABLE public.customer_access_tokens 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '72 hours');