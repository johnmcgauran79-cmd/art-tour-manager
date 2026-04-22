ALTER TABLE public.tour_custom_forms
  ADD COLUMN IF NOT EXISTS email_recipients text NOT NULL DEFAULT 'all_passengers';

UPDATE public.tour_custom_forms
SET email_recipients = CASE
  WHEN response_mode = 'per_booking' THEN 'lead_only'
  ELSE 'all_passengers'
END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tour_custom_forms_email_recipients_check'
  ) THEN
    ALTER TABLE public.tour_custom_forms
      ADD CONSTRAINT tour_custom_forms_email_recipients_check
      CHECK (email_recipients IN ('lead_only', 'all_passengers'));
  END IF;
END $$;

COMMENT ON COLUMN public.tour_custom_forms.email_recipients IS
  'Who receives the form request email: lead_only or all_passengers (default). Independent of response_mode.';