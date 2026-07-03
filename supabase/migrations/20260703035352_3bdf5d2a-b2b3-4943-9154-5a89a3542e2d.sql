
-- 1) PUSH SUBSCRIPTIONS: remover INSERT anônimo e expor via RPC validada
DROP POLICY IF EXISTS "push sub insert público" ON public.push_subscriptions;

REVOKE INSERT, UPDATE, DELETE ON public.push_subscriptions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_bolao_id uuid,
  p_torcedor_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_endpoint IS NULL OR length(p_endpoint) < 20 THEN
    RAISE EXCEPTION 'Endpoint inválido';
  END IF;
  IF p_p256dh IS NULL OR p_auth IS NULL THEN
    RAISE EXCEPTION 'Chaves de criptografia obrigatórias';
  END IF;
  IF p_bolao_id IS NULL OR p_torcedor_id IS NULL THEN
    RAISE EXCEPTION 'Bolão e torcedor obrigatórios';
  END IF;
  -- Torcedor precisa pertencer ao bolão informado
  IF NOT EXISTS (
    SELECT 1 FROM public.torcedores
    WHERE id = p_torcedor_id AND bolao_id = p_bolao_id
  ) THEN
    RAISE EXCEPTION 'Torcedor não pertence a este bolão';
  END IF;
  -- Rate limit por endpoint
  IF NOT public.check_rate_limit(p_endpoint, 'register_push', 5, 60) THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns segundos.';
  END IF;

  INSERT INTO public.push_subscriptions (torcedor_id, bolao_id, endpoint, p256dh, auth, user_agent, last_used_at)
  VALUES (p_torcedor_id, p_bolao_id, p_endpoint, p_p256dh, p_auth, p_user_agent, now())
  ON CONFLICT (endpoint) DO UPDATE SET
    torcedor_id = EXCLUDED.torcedor_id,
    bolao_id = EXCLUDED.bolao_id,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent,
    last_used_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_push_subscription(p_endpoint text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(uuid, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(uuid, uuid, text, text, text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.unregister_push_subscription(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unregister_push_subscription(text) TO anon, authenticated;

-- 2) MATERIALIZED VIEWS fora da Data API: mover para schema `private`
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

ALTER MATERIALIZED VIEW IF EXISTS public.mv_ranking_torcedores SET SCHEMA private;
ALTER MATERIALIZED VIEW IF EXISTS public.mv_dashboard_organizador SET SCHEMA private;

-- Recriar RPCs que referenciavam public.mv_*
CREATE OR REPLACE FUNCTION public.refresh_ranking()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY private.mv_ranking_torcedores; END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_organizador()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY private.mv_dashboard_organizador; END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_organizador()
RETURNS SETOF private.mv_dashboard_organizador
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT mv.* FROM private.mv_dashboard_organizador mv
  JOIN public.tenants t ON t.id = mv.tenant_id
  WHERE t.owner_user_id = auth.uid()
     OR public.has_role(auth.uid(), 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.get_bolao_ranking(p_slug text)
RETURNS TABLE(torcedor_id uuid, nome text, acertos_exatos bigint, acertos_resultado bigint, total bigint, pontos bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT mv.torcedor_id, mv.nome, mv.acertos_exatos, mv.acertos_resultado, mv.total, mv.pontos
  FROM private.mv_ranking_torcedores mv
  JOIN public.boloes b ON b.id = mv.bolao_id
  WHERE b.slug = p_slug AND b.status = 'active'
  ORDER BY mv.pontos DESC, mv.acertos_exatos DESC;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_organizador() FROM anon;
REVOKE ALL ON FUNCTION public.refresh_ranking() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_dashboard_organizador() FROM anon, authenticated;
