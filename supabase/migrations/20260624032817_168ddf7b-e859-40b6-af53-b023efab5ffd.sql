CREATE OR REPLACE FUNCTION public.submit_palpite(p_bolao_id uuid, p_nome text, p_whatsapp text, p_match_id uuid, p_palpite_a integer, p_palpite_b integer)
 RETURNS TABLE(palpite_id uuid, codigo integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bolao public.boloes%ROWTYPE;
  v_match public.matches%ROWTYPE;
  v_torcedor_id uuid;
  v_palpite_id uuid;
  v_codigo integer;
  v_valor numeric(10,2);
BEGIN
  IF p_palpite_a < 0 OR p_palpite_b < 0 THEN
    RAISE EXCEPTION 'Palpite inválido';
  END IF;

  SELECT * INTO v_bolao FROM public.boloes WHERE id = p_bolao_id;
  IF NOT FOUND OR v_bolao.status <> 'active' THEN
    RAISE EXCEPTION 'Bolão indisponível';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jogo não encontrado';
  END IF;

  -- Novo padrão: palpites encerram automaticamente no horário de início do jogo
  IF v_match.kickoff_at IS NOT NULL AND v_match.kickoff_at <= now() THEN
    RAISE EXCEPTION 'Palpites encerrados: o jogo já começou';
  END IF;
  IF v_match.status IN ('live','finished') THEN
    RAISE EXCEPTION 'Palpites encerrados para este jogo';
  END IF;

  -- Limite global opcional (override do organizador)
  IF v_bolao.data_limite_palpite IS NOT NULL AND v_bolao.data_limite_palpite <= now() THEN
    RAISE EXCEPTION 'Prazo geral para palpites encerrado';
  END IF;

  v_valor := COALESCE(v_bolao.valor_palpite, 0);

  INSERT INTO public.torcedores (tenant_id, bolao_id, nome, whatsapp)
  VALUES (v_bolao.tenant_id, v_bolao.id, btrim(p_nome), p_whatsapp)
  ON CONFLICT (bolao_id, whatsapp) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_torcedor_id;

  INSERT INTO public.palpites (tenant_id, bolao_id, torcedor_id, match_id, palpite_a, palpite_b, valor)
  VALUES (v_bolao.tenant_id, v_bolao.id, v_torcedor_id, p_match_id, p_palpite_a, p_palpite_b, v_valor)
  RETURNING id, palpites.codigo INTO v_palpite_id, v_codigo;

  palpite_id := v_palpite_id;
  codigo := v_codigo;
  RETURN NEXT;
END;
$function$;