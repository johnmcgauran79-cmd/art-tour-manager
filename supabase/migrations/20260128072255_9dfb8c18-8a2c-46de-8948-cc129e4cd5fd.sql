-- Add host flights tracking fields to tours table
ALTER TABLE public.tours
ADD COLUMN host_flights_status TEXT DEFAULT 'not_required',
ADD COLUMN outbound_flight_number TEXT,
ADD COLUMN outbound_flight_date DATE,
ADD COLUMN return_flight_number TEXT,
ADD COLUMN return_flight_date DATE;