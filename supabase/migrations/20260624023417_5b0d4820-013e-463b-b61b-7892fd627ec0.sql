
-- 1) Remover tabelas sensíveis da publicação de Realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'palpites'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.palpites';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'torcedores'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.torcedores';
  END IF;
END $$;

-- 2) Impedir que anon leia token_acesso (também bloqueia INSERT ... RETURNING token_acesso)
REVOKE SELECT (token_acesso) ON public.torcedores FROM anon;

-- 3) Bloquear execução pública de funções SECURITY DEFINER internas e
--    manter apertas as funções de uso público (submit_palpite, get_bolao_ranking)

-- Funções de trigger: ninguém precisa executar diretamente
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_palpite_limit() FROM PUBLIC, anon, authenticated;

-- Funções usadas dentro de policies/server fns: só authenticated precisa
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;

-- Funções públicas do fluxo do bolão: anon e authenticated podem chamar
REVOKE ALL ON FUNCTION public.submit_palpite(uuid, text, text, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_palpite(uuid, text, text, uuid, integer, integer) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_bolao_ranking(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bolao_ranking(text) TO anon, authenticated;
