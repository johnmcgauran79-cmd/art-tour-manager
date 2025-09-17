-- Update existing phone numbers to WhatsApp format
-- This migration converts all phone numbers in the customers table to international format

-- Create a temporary function to format phone numbers for WhatsApp
CREATE OR REPLACE FUNCTION format_phone_for_whatsapp(phone_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    cleaned TEXT;
    digits_only TEXT;
    without_leading_zero TEXT;
BEGIN
    -- Return null for empty/null input
    IF phone_input IS NULL OR phone_input = '' THEN
        RETURN NULL;
    END IF;
    
    -- Remove all non-digit characters except +
    cleaned := regexp_replace(phone_input, '[^0-9+]', '', 'g');
    
    -- If already starts with +, validate and return
    IF cleaned LIKE '+%' THEN
        digits_only := substring(cleaned, 2);
        IF length(digits_only) >= 10 AND length(digits_only) <= 15 THEN
            RETURN cleaned;
        ELSE
            RETURN NULL;
        END IF;
    END IF;
    
    -- Get digits only (remove any remaining +)
    digits_only := regexp_replace(cleaned, '[^0-9]', '', 'g');
    
    -- Return null if too short or too long
    IF length(digits_only) < 8 OR length(digits_only) > 15 THEN
        RETURN NULL;
    END IF;
    
    -- Check if it already includes a country code (starts with common international codes)
    IF digits_only LIKE '61%' AND length(digits_only) >= 11 THEN
        RETURN '+' || digits_only;
    ELSIF digits_only LIKE '1%' AND length(digits_only) >= 11 THEN  -- US/CA
        RETURN '+' || digits_only;
    ELSIF digits_only LIKE '44%' AND length(digits_only) >= 12 THEN  -- UK
        RETURN '+' || digits_only;
    ELSIF digits_only LIKE '49%' AND length(digits_only) >= 12 THEN  -- Germany
        RETURN '+' || digits_only;
    ELSIF digits_only LIKE '33%' AND length(digits_only) >= 11 THEN  -- France
        RETURN '+' || digits_only;
    ELSIF digits_only LIKE '64%' AND length(digits_only) >= 11 THEN  -- New Zealand
        RETURN '+' || digits_only;
    END IF;
    
    -- Handle Australian numbers (default for this business)
    -- Remove leading 0 if present
    without_leading_zero := CASE 
        WHEN digits_only LIKE '0%' THEN substring(digits_only, 2)
        ELSE digits_only
    END;
    
    -- Australian mobile numbers start with 4 and are 9 digits after removing leading 0
    IF without_leading_zero LIKE '4%' AND length(without_leading_zero) = 9 THEN
        RETURN '+61' || without_leading_zero;
    END IF;
    
    -- Australian landline numbers (state codes: 2,3,7,8) are typically 9 digits
    IF without_leading_zero ~ '^[2378]' AND length(without_leading_zero) = 9 THEN
        RETURN '+61' || without_leading_zero;
    END IF;
    
    -- If it's 10 digits and starts with 0, it's likely Australian
    IF length(digits_only) = 10 AND digits_only LIKE '0%' THEN
        RETURN '+61' || substring(digits_only, 2);
    END IF;
    
    -- Default: assume Australian and remove leading 0
    RETURN '+61' || without_leading_zero;
END;
$$;

-- Update all phone numbers in customers table
UPDATE customers 
SET phone = format_phone_for_whatsapp(phone)
WHERE phone IS NOT NULL 
  AND phone != '' 
  AND phone NOT LIKE '+%';

-- Also check and update lead_phone in bookings table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'lead_phone') THEN
        UPDATE bookings 
        SET lead_phone = format_phone_for_whatsapp(lead_phone)
        WHERE lead_phone IS NOT NULL 
          AND lead_phone != '' 
          AND lead_phone NOT LIKE '+%';
    END IF;
END $$;

-- Drop the temporary function
DROP FUNCTION format_phone_for_whatsapp(TEXT);