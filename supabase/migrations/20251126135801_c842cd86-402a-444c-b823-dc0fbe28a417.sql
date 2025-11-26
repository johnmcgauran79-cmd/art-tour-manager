-- Update the cron job to run daily at 6am AEST (8pm UTC previous day) to handle all rule types
SELECT cron.unschedule('process-weekly-automated-reports');

SELECT cron.schedule(
  'process-daily-automated-reports',
  '0 20 * * *', -- Every day at 20:00 UTC = 6am AEST next day (7am during daylight saving AEDT)
  $$
  SELECT
    net.http_post(
        url:='https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/process-scheduled-reports',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcXZndHV4ZnpzcndqYWhrbGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTg3OTIsImV4cCI6MjA2NTA5NDc5Mn0.2XXCeilTJt-_0UdN_TCiT3Zyie_ci9Iwx6F7ZTsH0XQ"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);