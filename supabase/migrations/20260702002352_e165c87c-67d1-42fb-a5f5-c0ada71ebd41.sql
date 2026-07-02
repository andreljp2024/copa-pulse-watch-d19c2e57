DROP VIEW IF EXISTS public.v_top_scorers;

CREATE VIEW public.v_top_scorers
WITH (security_invoker = on) AS
SELECT
  s.id           AS player_id,
  s.name,
  s.team_id,
  t.name         AS team_name,
  t.flag_url,
  COALESCE(s.team_code, t.code) AS team_code,
  s.goals,
  s.assists,
  s.penalties,
  s.nationality
FROM public.scorers s
LEFT JOIN public.teams t ON t.id = s.team_id
ORDER BY s.goals DESC, s.assists DESC NULLS LAST;

GRANT SELECT ON public.v_top_scorers TO anon, authenticated;