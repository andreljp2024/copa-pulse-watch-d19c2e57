CREATE OR REPLACE FUNCTION public.consultar_palpites_por_whatsapp(
  p_slug text,
  p_whatsapp text
)
RETURNS TABLE(
  codigo integer,
  nome_torcedor text,
  palpite_a integer,
  palpite_b integer,
  valor numeric,
  status_pagamento text,
  created_at timestamptz,
  kickoff_at timestamptz,
  home_team text,
  away_team text,
  placar_a integer,
  placar_b integer,
  match_status text,
  ganhou boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bolao_id uuid;
  v_digits text;
BEGIN
  v_digits := regexp_replace(COALESCE(p_whatsapp, ''), '\D', '', 'g');
  IF length(v_digits) > 11 AND left(v_digits, 2) = '55' THEN
    v_digits := substring(v_digits from 3);
  END IF;
  IF length(v_digits) < 8 THEN
    RETURN;
  END IF;

  SELECT id INTO v_bolao_id FROM public.boloes WHERE slug = p_slug AND status = 'active';
  IF v_bolao_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.codigo,
    t.nome,
    p.palpite_a,
    p.palpite_b,
    p.valor,
    p.status_pagamento,
    p.created_at,
    m.kickoff_at,
    ht.name AS home_team,
    at.name AS away_team,
    m.home_score AS placar_a,
    m.away_score AS placar_b,
    m.status::text AS match_status,
    (m.status::text = 'finished'
      AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
      AND p.palpite_a = m.home_score AND p.palpite_b = m.away_score
      AND p.status_pagamento = 'pago') AS ganhou
  FROM public.palpites p
  JOIN public.torcedores t ON t.id = p.torcedor_id
  LEFT JOIN public.matches m ON m.id = p.match_id
  LEFT JOIN public.teams ht ON ht.id = m.home_team_id
  LEFT JOIN public.teams at ON at.id = m.away_team_id
  WHERE p.bolao_id = v_bolao_id
    AND regexp_replace(
          regexp_replace(COALESCE(t.whatsapp, ''), '\D', '', 'g'),
          '^55(\d{11})$', '\1'
        ) = v_digits
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consultar_palpites_por_whatsapp(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultar_palpites_por_whatsapp(text, text) TO anon, authenticated;