-- Add tour_ids column to automated_report_rules (null means all tours)
ALTER TABLE public.automated_report_rules 
ADD COLUMN tour_ids uuid[] DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.automated_report_rules.tour_ids IS 'Optional array of specific tour IDs to send reports for. NULL means all upcoming tours.';