ALTER TABLE public.palpites REPLICA IDENTITY FULL;
ALTER TABLE public.torcedores REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.palpites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.torcedores;