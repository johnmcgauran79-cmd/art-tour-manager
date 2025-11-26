-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job to process automated reports every Monday at 6am AEST (8pm UTC Sunday)
SELECT cron.schedule(
  'process-weekly-automated-reports',
  '0 20 * * 0', -- Every Sunday at 20:00 UTC = 6am AEST Monday (7am during daylight saving AEDT)
  $$
  SELECT
    net.http_post(
        url:='https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/process-scheduled-reports',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcXZndHV4ZnpzcndqYWhrbGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTg3OTIsImV4cCI6MjA2NTA5NDc5Mn0.2XXCeilTJt-_0UdN_TCiT3Zyie_ci9Iwx6F7ZTsH0XQ"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);