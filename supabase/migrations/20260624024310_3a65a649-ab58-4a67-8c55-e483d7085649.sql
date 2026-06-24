
DO $$
BEGIN
  PERFORM cron.unschedule('sync-football-every-5-min')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-football-every-5-min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sync-football-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://project--84da67c1-66da-4335-845c-026539ecf393-dev.lovable.app/api/public/hooks/sync-football',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_wzusfhoPbTAL_Ogja0KkJg_buyYLLRf"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
