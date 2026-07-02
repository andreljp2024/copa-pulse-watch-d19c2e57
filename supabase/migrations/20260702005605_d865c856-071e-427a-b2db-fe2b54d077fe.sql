SELECT cron.unschedule('sync-football-every-10-min');
SELECT cron.schedule(
  'sync-football-every-10-min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--84da67c1-66da-4335-845c-026539ecf393-dev.lovable.app/api/public/hooks/sync-football',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_wzusfhoPbTAL_Ogja0KkJg_buyYLLRf'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
SELECT net.http_post(
  url := 'https://project--84da67c1-66da-4335-845c-026539ecf393-dev.lovable.app/api/public/hooks/sync-football',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', 'sb_publishable_wzusfhoPbTAL_Ogja0KkJg_buyYLLRf'
  ),
  body := '{}'::jsonb
) AS request_id;