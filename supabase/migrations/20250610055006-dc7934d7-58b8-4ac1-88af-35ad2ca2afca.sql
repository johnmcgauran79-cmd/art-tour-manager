
-- Add tour capacity field to tours table
ALTER TABLE tours ADD COLUMN capacity INTEGER DEFAULT 50;

-- Add new transport fields to activities table (some may already exist)
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS pickup_time TIME,
ADD COLUMN IF NOT EXISTS pickup_location TEXT,
ADD COLUMN IF NOT EXISTS dropoff_location TEXT,
ADD COLUMN IF NOT EXISTS collection_time TIME,
ADD COLUMN IF NOT EXISTS collection_location TEXT;
