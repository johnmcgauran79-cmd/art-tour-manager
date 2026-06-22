ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS cancellation_policy_override jsonb,
  ADD COLUMN IF NOT EXISTS cancellation_policy_enabled boolean NOT NULL DEFAULT true;

INSERT INTO public.general_settings (setting_key, setting_value, description)
VALUES (
  'cancellation_policy',
  '{"title":"Cancellation Policy","rows":[{"notice":"180+ days prior to departure","refund":"Full refund, less 10% administration fee"},{"notice":"90\u2013179 days prior to departure","refund":"50% refund of all payments made"},{"notice":"Within 90 days of departure","refund":"No refund available"}]}'::jsonb,
  'Global cancellation policy table shown at the top of Additional Information in guest documents and emails. Can be overridden per tour.'
)
ON CONFLICT (setting_key) DO NOTHING;