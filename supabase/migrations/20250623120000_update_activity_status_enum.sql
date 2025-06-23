
-- Update activity_status enum to include new options
ALTER TYPE activity_status ADD VALUE IF NOT EXISTS 'planned';
ALTER TYPE activity_status ADD VALUE IF NOT EXISTS 'contacted_enquiry_sent';
ALTER TYPE activity_status ADD VALUE IF NOT EXISTS 'tentative_booking';
ALTER TYPE activity_status ADD VALUE IF NOT EXISTS 'finalised';
ALTER TYPE activity_status ADD VALUE IF NOT EXISTS 'on_hold';

-- Note: 'confirmed' and 'cancelled' already exist, 'pending' will be kept for backwards compatibility
