CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('video-jobs-worker') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'video-jobs-worker');

SELECT cron.schedule(
  'video-jobs-worker',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--6435e64a-9910-4aa5-bc02-839318984112.lovable.app/api/public/hooks/video-jobs',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyZ3VydnVhZHF5bXljb3hiYnFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyODA5NzAsImV4cCI6MjA5Nzg1Njk3MH0.j66voiycB7K0c0JcQlGjZtDEZKdBbRetbn0rb4RxGW0"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);