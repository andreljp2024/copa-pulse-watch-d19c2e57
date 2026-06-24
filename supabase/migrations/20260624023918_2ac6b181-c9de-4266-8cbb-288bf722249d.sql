
-- 1) Unique index so we can UPSERT matches by (home, away, kickoff) instead of wiping the table
CREATE UNIQUE INDEX IF NOT EXISTS matches_home_away_kickoff_uidx
  ON public.matches (home_team_id, away_team_id, kickoff_at);

-- 2) pg_cron + pg_net for scheduling HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3) Schedule (idempotent): unschedule prior job if it exists, then re-create
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
    url     := 'https://project--84da67c1-66da-4335-845c-026539ecf393.lovable.app/api/public/hooks/sync-football',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_wzusfhoPbTAL_Ogja0KkJg_buyYLLRf"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
