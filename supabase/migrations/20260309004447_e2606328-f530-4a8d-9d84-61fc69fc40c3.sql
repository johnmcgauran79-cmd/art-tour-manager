ALTER TABLE public.customer_access_tokens 
ALTER COLUMN expires_at SET DEFAULT (now() + '7 days'::interval);