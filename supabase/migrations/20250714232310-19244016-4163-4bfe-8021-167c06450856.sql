-- Add missing activity status values to match the UI dropdown options
ALTER TYPE activity_status ADD VALUE 'contacted_enquiry_sent';
ALTER TYPE activity_status ADD VALUE 'tentative_booking';  
ALTER TYPE activity_status ADD VALUE 'finalised';
ALTER TYPE activity_status ADD VALUE 'cancelled';