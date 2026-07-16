-- ============================================================
-- Módulo palpites: tratamento amigável de palpite duplicado
-- e reforço de validações em submit_palpite()
-- ============================================================

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
  v_existente int;
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

  -- Garante o torcedor (idempotente por bolão+whatsapp)
  INSERT INTO public.torcedores (tenant_id, bolao_id, nome, whatsapp)
  VALUES (v_bolao.tenant_id, v_bolao.id, btrim(p_nome), p_whatsapp)
  ON CONFLICT (bolao_id, whatsapp) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_torcedor_id;

  -- Palpite duplicado no mesmo jogo: mensagem amigável em vez de erro 23505
  SELECT count(*) INTO v_existente
  FROM public.palpites
  WHERE torcedor_id = v_torcedor_id AND match_id = p_match_id;
  IF v_existente > 0 THEN
    RAISE EXCEPTION 'Você já registrou um palpite para este jogo neste bolão.'
      USING ERRCODE = 'unique_violation';
  END IF;

  v_valor := COALESCE(v_bolao.valor_palpite, 0);

  INSERT INTO public.palpites (tenant_id, bolao_id, torcedor_id, match_id, palpite_a, palpite_b, valor)
  VALUES (v_bolao.tenant_id, v_bolao.id, v_torcedor_id, p_match_id, p_palpite_a, p_palpite_b, v_valor)
  RETURNING id, palpites.codigo INTO v_palpite_id, v_codigo;

  palpite_id := v_palpite_id; codigo := v_codigo; RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.submit_palpite(uuid,text,text,uuid,integer,integer)
  IS 'Registra palpite público com validações de prazo, jogo no bolão, anti-fraude e bloqueio de palpite duplicado por torcedor+jogo.';
