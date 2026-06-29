CREATE OR REPLACE FUNCTION public.get_bolao_ranking(p_slug text)
RETURNS TABLE (
  torcedor_id uuid,
  nome text,
  acertos_exatos bigint,
  acertos_resultado bigint,
  total bigint,
  pontos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH b AS (
    SELECT id
    FROM public.boloes
    WHERE slug = p_slug
      AND status = 'active'
      AND permitir_ranking_publico IS TRUE
    LIMIT 1
  ), scored AS (
    SELECT
      p.torcedor_id,
      (p.palpite_a = m.home_score AND p.palpite_b = m.away_score) AS exato,
      (sign(p.palpite_a - p.palpite_b) = sign(m.home_score - m.away_score)) AS res
    FROM public.palpites p
    JOIN public.matches m ON m.id = p.match_id AND m.status = 'finished'
    WHERE p.bolao_id = (SELECT id FROM b)
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
  )
  SELECT
    s.torcedor_id,
    t.nome,
    count(*) FILTER (WHERE s.exato) AS acertos_exatos,
    count(*) FILTER (WHERE NOT s.exato AND s.res) AS acertos_resultado,
    count(*)::bigint AS total,
    (10 * count(*) FILTER (WHERE s.exato) + 5 * count(*) FILTER (WHERE NOT s.exato AND s.res))::bigint AS pontos
  FROM scored s
  JOIN public.torcedores t ON t.id = s.torcedor_id
  GROUP BY s.torcedor_id, t.nome
  ORDER BY pontos DESC, acertos_exatos DESC;
$$;

REVOKE ALL ON FUNCTION public.get_bolao_ranking(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bolao_ranking(text) TO anon, authenticated;
