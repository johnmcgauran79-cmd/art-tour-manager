
-- Add minimum_passengers_required column to tours table
ALTER TABLE tours 
ADD COLUMN minimum_passengers_required integer;

-- Add a comment to document the field
COMMENT ON COLUMN tours.minimum_passengers_required IS 'Minimum number of passengers required for the tour to proceed';
