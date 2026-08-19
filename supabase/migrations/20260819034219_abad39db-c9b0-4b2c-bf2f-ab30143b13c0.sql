SELECT cron.unschedule('perf-samples-purge');

SELECT cron.schedule(
  'monitoring-purge',
  '20 3 * * *',
  $$ SELECT public.cleanup_monitoring(); $$
);

SELECT cron.schedule(
  'video-worker-health',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--6435e64a-9910-4aa5-bc02-839318984112.lovable.app/api/public/hooks/worker-health',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);