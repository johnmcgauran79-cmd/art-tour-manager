-- Create table to track suppressed/bounced email addresses
CREATE TABLE public.email_suppressions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_address TEXT NOT NULL,
  suppression_type TEXT NOT NULL DEFAULT 'bounced',
  reason TEXT,
  first_bounced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_bounced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  bounce_count INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email_address)
);

-- Enable RLS
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view suppressions"
ON public.email_suppressions
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage suppressions"
ON public.email_suppressions
FOR ALL
USING (true);

-- Create index for quick lookups
CREATE INDEX idx_email_suppressions_email ON public.email_suppressions(email_address);
CREATE INDEX idx_email_suppressions_active ON public.email_suppressions(is_active) WHERE is_active = true;