SELECT cron.unschedule('sync-football-every-10-min');
SELECT cron.schedule(
  'sync-football-every-10-min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--84da67c1-66da-4335-845c-026539ecf393-dev.lovable.app/api/public/hooks/sync-football',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);