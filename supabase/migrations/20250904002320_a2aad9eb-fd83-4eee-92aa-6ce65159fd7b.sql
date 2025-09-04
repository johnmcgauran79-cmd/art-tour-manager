-- Add operations notes fields to tours table
ALTER TABLE tours 
ADD COLUMN ops_notes text,
ADD COLUMN ops_accomm_notes text,
ADD COLUMN ops_races_notes text,
ADD COLUMN ops_transport_notes text,
ADD COLUMN ops_dinner_notes text,
ADD COLUMN ops_activities_notes text;