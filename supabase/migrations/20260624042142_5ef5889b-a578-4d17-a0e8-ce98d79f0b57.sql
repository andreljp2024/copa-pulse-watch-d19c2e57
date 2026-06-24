
CREATE TABLE IF NOT EXISTS public.bolao_matches (
  bolao_id uuid NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bolao_id, match_id)
);

GRANT SELECT ON public.bolao_matches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bolao_matches TO authenticated;
GRANT ALL ON public.bolao_matches TO service_role;

ALTER TABLE public.bolao_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bolao_matches public read active"
  ON public.bolao_matches FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.boloes b
                 WHERE b.id = bolao_matches.bolao_id AND b.status = 'active'));

CREATE POLICY "bolao_matches tenant insert"
  ON public.bolao_matches FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.boloes b
                      WHERE b.id = bolao_matches.bolao_id
                        AND (b.tenant_id = public.current_tenant_id()
                             OR public.has_role(auth.uid(), 'super_admin'::app_role))));

CREATE POLICY "bolao_matches tenant delete"
  ON public.bolao_matches FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.boloes b
                 WHERE b.id = bolao_matches.bolao_id
                   AND (b.tenant_id = public.current_tenant_id()
                        OR public.has_role(auth.uid(), 'super_admin'::app_role))));

CREATE INDEX IF NOT EXISTS bolao_matches_bolao_idx ON public.bolao_matches(bolao_id);
CREATE INDEX IF NOT EXISTS bolao_matches_match_idx ON public.bolao_matches(match_id);

-- Atualizar submit_palpite para validar que o match pertence ao bolão (se houver vínculos)
CREATE OR REPLACE FUNCTION public.submit_palpite(
  p_bolao_id uuid, p_nome text, p_whatsapp text,
  p_match_id uuid, p_palpite_a integer, p_palpite_b integer
)
RETURNS TABLE(palpite_id uuid, codigo integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bolao public.boloes%ROWTYPE;
  v_match public.matches%ROWTYPE;
  v_torcedor_id uuid;
  v_palpite_id uuid;
  v_codigo integer;
  v_valor numeric(10,2);
  v_has_links boolean;
  v_in_bolao boolean;
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

  -- Se o bolão tem jogos vinculados, exigir que o match pertença ao bolão
  SELECT EXISTS (SELECT 1 FROM public.bolao_matches WHERE bolao_id = v_bolao.id) INTO v_has_links;
  IF v_has_links THEN
    SELECT EXISTS (SELECT 1 FROM public.bolao_matches
                   WHERE bolao_id = v_bolao.id AND match_id = p_match_id) INTO v_in_bolao;
    IF NOT v_in_bolao THEN
      RAISE EXCEPTION 'Este jogo não faz parte deste bolão';
    END IF;
  END IF;

  IF v_match.kickoff_at IS NOT NULL AND v_match.kickoff_at <= now() THEN
    RAISE EXCEPTION 'Palpites encerrados: o jogo já começou';
  END IF;
  IF v_match.status IN ('live','finished') THEN
    RAISE EXCEPTION 'Palpites encerrados para este jogo';
  END IF;

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
$$;
