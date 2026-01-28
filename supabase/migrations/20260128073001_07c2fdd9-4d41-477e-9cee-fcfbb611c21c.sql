-- Change default for new tours to 'not_booked'
ALTER TABLE public.tours 
ALTER COLUMN host_flights_status SET DEFAULT 'not_booked';

-- Update all existing tours to 'not_booked'
UPDATE public.tours 
SET host_flights_status = 'not_booked' 
WHERE host_flights_status IS NULL OR host_flights_status = 'not_required';