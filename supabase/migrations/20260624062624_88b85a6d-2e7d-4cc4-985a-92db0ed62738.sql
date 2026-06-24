-- Remove broad SELECT for anon and replace with explicit non-sensitive columns.
REVOKE SELECT ON public.boloes FROM anon;
GRANT SELECT (
  id, nome, slug, descricao, regras, valor_palpite, status,
  logo_url, cor_primaria, cor_secundaria,
  permitir_ranking_publico, permitir_ganhadores_publico,
  data_limite_palpite, created_at, updated_at
) ON public.boloes TO anon;
