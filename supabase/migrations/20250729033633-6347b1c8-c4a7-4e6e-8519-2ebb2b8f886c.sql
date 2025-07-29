-- Add a unique constraint to prevent future duplicate hotel booking allocations
-- A booking can only be allocated to the same hotel once
CREATE UNIQUE INDEX idx_hotel_bookings_unique_allocation 
ON hotel_bookings (booking_id, hotel_id) 
WHERE allocated = true;