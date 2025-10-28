
-- Function to migrate dietary restrictions from bookings to customer profiles
CREATE OR REPLACE FUNCTION public.migrate_dietary_to_customer_profile(p_customer_id uuid, p_dietary_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE customers 
  SET dietary_requirements = p_dietary_value,
      updated_at = now()
  WHERE id = p_customer_id;
  
  -- Log the migration
  INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
  VALUES (
    COALESCE(auth.uid(), (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1)),
    'MIGRATE_DIETARY',
    'customers',
    p_customer_id,
    jsonb_build_object('dietary_value', p_dietary_value, 'source', 'booking_migration')
  );
END;
$$;

-- Execute the migration for Josephine Bainbridge
SELECT migrate_dietary_to_customer_profile(
  '3781ee3f-4ccc-44db-bc37-8de8ca3f7abd'::uuid,
  'Jessie (Gluten Free) Mike (Diabetic)'
);
