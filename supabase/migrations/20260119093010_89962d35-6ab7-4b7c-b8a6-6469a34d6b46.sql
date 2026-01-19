-- Create table for customer access tokens (magic links)
CREATE TABLE public.customer_access_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  last_used_at timestamp with time zone,
  use_count integer NOT NULL DEFAULT 0
);

-- Create index for token lookups
CREATE INDEX idx_customer_access_tokens_token ON public.customer_access_tokens(token);
CREATE INDEX idx_customer_access_tokens_customer ON public.customer_access_tokens(customer_id);
CREATE INDEX idx_customer_access_tokens_expires ON public.customer_access_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.customer_access_tokens ENABLE ROW LEVEL SECURITY;

-- Staff can create and view tokens
CREATE POLICY "Staff can create customer access tokens"
ON public.customer_access_tokens
FOR INSERT
WITH CHECK (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
);

CREATE POLICY "Staff can view customer access tokens"
ON public.customer_access_tokens
FOR SELECT
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
);

-- Allow public access for token validation (edge function will handle this)
CREATE POLICY "Public can validate tokens"
ON public.customer_access_tokens
FOR SELECT
USING (true);

-- Allow updates for tracking usage (edge function needs this)
CREATE POLICY "System can update token usage"
ON public.customer_access_tokens
FOR UPDATE
USING (true);

-- Create table for profile update audit log
CREATE TABLE public.customer_profile_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token_id uuid REFERENCES public.customer_access_tokens(id) ON DELETE SET NULL,
  changes jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Enable RLS
ALTER TABLE public.customer_profile_updates ENABLE ROW LEVEL SECURITY;

-- Staff can view update history
CREATE POLICY "Staff can view profile updates"
ON public.customer_profile_updates
FOR SELECT
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
);

-- System can insert updates (from edge function)
CREATE POLICY "System can insert profile updates"
ON public.customer_profile_updates
FOR INSERT
WITH CHECK (true);