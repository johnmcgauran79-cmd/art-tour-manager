-- Remove duplicate hotel booking allocations for the Wales booking
-- Keep only the most recent allocation for each hotel

-- Delete the earlier duplicate for Jockey Club Rooms (keep the later one)
DELETE FROM hotel_bookings 
WHERE id = '17274df8-a5df-4d3f-bed9-3cfb891c903b';