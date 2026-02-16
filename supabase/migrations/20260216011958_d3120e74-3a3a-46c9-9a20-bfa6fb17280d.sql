-- Schedule contacts-only auto sync every 4 hours
SELECT cron.schedule(
  'xero-auto-sync-contacts',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/sync-xero-contacts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcXZndHV4ZnpzcndqYWhrbGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTg3OTIsImV4cCI6MjA2NTA5NDc5Mn0.2XXCeilTJt-_0UdN_TCiT3Zyie_ci9Iwx6F7ZTsH0XQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);