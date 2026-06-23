ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.match_events REPLICA IDENTITY FULL;
ALTER TABLE public.match_statistics REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='matches') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='match_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='match_statistics') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_statistics;
  END IF;
END $$;