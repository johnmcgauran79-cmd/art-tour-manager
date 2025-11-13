-- Add 'limited_availability' to tour_status enum
ALTER TYPE tour_status ADD VALUE IF NOT EXISTS 'limited_availability';