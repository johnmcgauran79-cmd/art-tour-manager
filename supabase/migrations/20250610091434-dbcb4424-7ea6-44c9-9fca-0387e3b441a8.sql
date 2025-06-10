
-- Add instalment_amount and instalment_date columns to the tours table
ALTER TABLE tours 
ADD COLUMN instalment_amount numeric,
ADD COLUMN instalment_date date;
