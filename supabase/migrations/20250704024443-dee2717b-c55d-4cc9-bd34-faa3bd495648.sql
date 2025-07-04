
-- Add 'not_required' to the transport_status enum if it doesn't already exist
ALTER TYPE transport_status ADD VALUE IF NOT EXISTS 'not_required';
