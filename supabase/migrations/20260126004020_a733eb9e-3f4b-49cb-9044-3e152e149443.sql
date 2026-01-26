-- Step 1: Add 'host' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'host';