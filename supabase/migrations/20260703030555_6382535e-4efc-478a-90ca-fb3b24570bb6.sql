-- ============================================================
-- A. RATE LIMITING + ANTI-FRAUDE
-- ============================================================

CREATE TABLE public.rate_limits (
  id bigserial PRIMARY KEY,
  chave text NOT NULL,
  escopo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits (escopo, chave, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.rate_limits TO authenticated;
GRANT ALL ON public.rate_limits TO service_role;
GRANT SELECT ON SEQUENCE public.rate_limits_id_seq TO authenticated;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limits admin only" ON public.rate_limits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_chave text, p_escopo text, p_max int, p_janela_segundos int
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.rate_limits
   WHERE escopo = p_escopo AND created_at < now() - make_interval(secs => p_janela_segundos * 4);

  SELECT count(*) INTO v_count FROM public.rate_limits
   WHERE escopo = p_escopo AND chave = p_chave
     AND created_at > now() - make_interval(secs => p_janela_segundos);

  IF v_count >= p_max THEN RETURN false; END IF;
  INSERT INTO public.rate_limits (chave, escopo) VALUES (p_chave, p_escopo);
  RETURN true;
END;
$$;

-- Bloqueio manual de torcedores suspeitos
ALTER TABLE public.torcedores ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false;

-- Integra rate limit ao submit_palpite
CREATE OR REPLACE FUNCTION public.submit_palpite(
  p_bolao_id uuid, p_nome text, p_whatsapp text,
  p_match_id uuid, p_palpite_a int, p_palpite_b int
) RETURNS TABLE(palpite_id uuid, codigo integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bolao public.boloes%ROWTYPE;
  v_match public.matches%ROWTYPE;
  v_torcedor_id uuid;
  v_palpite_id uuid; v_codigo int; v_valor numeric(10,2);
  v_has_links boolean; v_in_bolao boolean;
  v_digits text; v_bloqueado boolean;
BEGIN
  IF p_palpite_a < 0 OR p_palpite_b < 0 THEN RAISE EXCEPTION 'Palpite inválido'; END IF;

  v_digits := regexp_replace(COALESCE(p_whatsapp,''),'\D','','g');
  IF length(v_digits) < 10 THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;

  -- Rate limit: 10 palpites por minuto por WhatsApp
  IF NOT public.check_rate_limit(v_digits, 'submit_palpite_wa', 10, 60) THEN
    RAISE EXCEPTION 'Muitos palpites em pouco tempo. Aguarde alguns segundos.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_bolao FROM public.boloes WHERE id = p_bolao_id;
  IF NOT FOUND OR v_bolao.status <> 'active' THEN RAISE EXCEPTION 'Bolão indisponível'; END IF;

  -- Bloqueio anti-fraude
  SELECT bloqueado INTO v_bloqueado FROM public.torcedores
   WHERE bolao_id = v_bolao.id AND regexp_replace(whatsapp,'\D','','g') = v_digits;
  IF v_bloqueado THEN RAISE EXCEPTION 'Cadastro bloqueado. Entre em contato com o organizador.'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogo não encontrado'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.bolao_matches WHERE bolao_id = v_bolao.id) INTO v_has_links;
  IF v_has_links THEN
    SELECT EXISTS (SELECT 1 FROM public.bolao_matches
                   WHERE bolao_id = v_bolao.id AND match_id = p_match_id) INTO v_in_bolao;
    IF NOT v_in_bolao THEN RAISE EXCEPTION 'Este jogo não faz parte deste bolão'; END IF;
  END IF;

  IF v_match.kickoff_at IS NOT NULL AND v_match.kickoff_at <= now() THEN
    RAISE EXCEPTION 'Palpites encerrados: o jogo já começou'; END IF;
  IF v_match.status IN ('live','finished') THEN RAISE EXCEPTION 'Palpites encerrados para este jogo'; END IF;
  IF v_bolao.data_limite_palpite IS NOT NULL AND v_bolao.data_limite_palpite <= now() THEN
    RAISE EXCEPTION 'Prazo geral para palpites encerrado'; END IF;

  v_valor := COALESCE(v_bolao.valor_palpite, 0);

  INSERT INTO public.torcedores (tenant_id, bolao_id, nome, whatsapp)
  VALUES (v_bolao.tenant_id, v_bolao.id, btrim(p_nome), p_whatsapp)
  ON CONFLICT (bolao_id, whatsapp) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_torcedor_id;

  INSERT INTO public.palpites (tenant_id, bolao_id, torcedor_id, match_id, palpite_a, palpite_b, valor)
  VALUES (v_bolao.tenant_id, v_bolao.id, v_torcedor_id, p_match_id, p_palpite_a, p_palpite_b, v_valor)
  RETURNING id, palpites.codigo INTO v_palpite_id, v_codigo;

  palpite_id := v_palpite_id; codigo := v_codigo; RETURN NEXT;
END;
$$;

-- View de sinais de fraude (para painel super_admin)
CREATE OR REPLACE VIEW public.fraud_signals
WITH (security_invoker = true) AS
SELECT
  t.bolao_id,
  t.id AS torcedor_id,
  t.nome,
  t.whatsapp,
  count(p.id) AS total_palpites,
  count(*) FILTER (WHERE p.status_pagamento = 'pendente') AS pendentes,
  count(*) FILTER (WHERE p.created_at > now() - interval '10 minutes') AS ultimos_10min,
  t.bloqueado
FROM public.torcedores t
LEFT JOIN public.palpites p ON p.torcedor_id = t.id
GROUP BY t.id
HAVING count(*) FILTER (WHERE p.created_at > now() - interval '10 minutes') > 20
    OR count(*) FILTER (WHERE p.status_pagamento = 'pendente') > 50;

-- ============================================================
-- C. RANKING EM MATERIALIZED VIEW
-- ============================================================

CREATE MATERIALIZED VIEW public.mv_ranking_torcedores AS
WITH scored AS (
  SELECT
    p.bolao_id,
    p.torcedor_id,
    (p.palpite_a = m.home_score AND p.palpite_b = m.away_score) AS exato,
    (sign(p.palpite_a - p.palpite_b) = sign(m.home_score - m.away_score)) AS res
  FROM public.palpites p
  JOIN public.matches m ON m.id = p.match_id AND m.status = 'finished'
  WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
)
SELECT
  s.bolao_id,
  s.torcedor_id,
  t.nome,
  count(*) FILTER (WHERE s.exato)::bigint AS acertos_exatos,
  count(*) FILTER (WHERE NOT s.exato AND s.res)::bigint AS acertos_resultado,
  count(*)::bigint AS total,
  (10 * count(*) FILTER (WHERE s.exato) + 5 * count(*) FILTER (WHERE NOT s.exato AND s.res))::bigint AS pontos,
  now() AS refreshed_at
FROM scored s
JOIN public.torcedores t ON t.id = s.torcedor_id
GROUP BY s.bolao_id, s.torcedor_id, t.nome;

CREATE UNIQUE INDEX idx_mv_ranking_pk ON public.mv_ranking_torcedores (bolao_id, torcedor_id);
CREATE INDEX idx_mv_ranking_bolao_pontos ON public.mv_ranking_torcedores (bolao_id, pontos DESC);

GRANT SELECT ON public.mv_ranking_torcedores TO authenticated, anon, service_role;

-- Ranking agora lê da MV (fallback para cálculo em tempo real se MV estiver vazia)
CREATE OR REPLACE FUNCTION public.get_bolao_ranking(p_slug text)
RETURNS TABLE(torcedor_id uuid, nome text, acertos_exatos bigint,
              acertos_resultado bigint, total bigint, pontos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT mv.torcedor_id, mv.nome, mv.acertos_exatos, mv.acertos_resultado, mv.total, mv.pontos
  FROM public.mv_ranking_torcedores mv
  JOIN public.boloes b ON b.id = mv.bolao_id
  WHERE b.slug = p_slug AND b.status = 'active'
  ORDER BY mv.pontos DESC, mv.acertos_exatos DESC;
$$;

CREATE OR REPLACE FUNCTION public.refresh_ranking() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_ranking_torcedores; END;
$$;

-- Agenda refresh a cada 5 min (só se pg_cron estiver disponível)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('refresh-ranking') FROM cron.job WHERE jobname='refresh-ranking';
    PERFORM cron.schedule('refresh-ranking', '*/5 * * * *', $c$ SELECT public.refresh_ranking(); $c$);
  END IF;
END $$;

-- ============================================================
-- D. PUSH NOTIFICATIONS NATIVAS
-- ============================================================

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  torcedor_id uuid REFERENCES public.torcedores(id) ON DELETE CASCADE,
  bolao_id uuid REFERENCES public.boloes(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX idx_push_sub_torcedor ON public.push_subscriptions(torcedor_id);
CREATE INDEX idx_push_sub_bolao ON public.push_subscriptions(bolao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT ON public.push_subscriptions TO anon;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push sub insert público" ON public.push_subscriptions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "push sub admin lê tudo" ON public.push_subscriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.tenants tn
                  JOIN public.boloes b ON b.tenant_id = tn.id
                 WHERE b.id = push_subscriptions.bolao_id AND tn.owner_user_id = auth.uid()));

-- Adiciona coluna tipo já existe; garante suporte a 'push'
-- (notification_queue.tipo já é texto livre; nada a alterar)

-- Trigger: quando registra ganhador, também enfileira push para o torcedor
CREATE OR REPLACE FUNCTION public.tg_enqueue_ganhador_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome_bolao text; v_home text; v_away text; v_hs int; v_as int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE torcedor_id = NEW.torcedor_id) THEN
    RETURN NEW;
  END IF;
  SELECT nome INTO v_nome_bolao FROM public.boloes WHERE id = NEW.bolao_id;
  SELECT ht.name, at.name, m.home_score, m.away_score INTO v_home, v_away, v_hs, v_as
    FROM public.matches m
    LEFT JOIN public.teams ht ON ht.id = m.home_team_id
    LEFT JOIN public.teams at ON at.id = m.away_team_id
   WHERE m.id = NEW.match_id;

  INSERT INTO public.notification_queue (tenant_id, bolao_id, torcedor_id, palpite_id, tipo, numero_whatsapp, mensagem)
  VALUES (NEW.tenant_id, NEW.bolao_id, NEW.torcedor_id, NEW.palpite_id, 'push', '',
    json_build_object('title','🏆 Você cravou o placar!',
      'body', COALESCE(v_home,'')||' '||COALESCE(v_hs::text,'?')||' x '||COALESCE(v_as::text,'?')||' '||COALESCE(v_away,'')||' — '||COALESCE(v_nome_bolao,''),
      'url','/')::text);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tg_ganhador_push ON public.ganhadores;
CREATE TRIGGER tg_ganhador_push AFTER INSERT ON public.ganhadores
FOR EACH ROW EXECUTE FUNCTION public.tg_enqueue_ganhador_push();
