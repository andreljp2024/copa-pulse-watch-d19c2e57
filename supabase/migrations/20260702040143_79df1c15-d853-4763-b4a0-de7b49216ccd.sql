
CREATE OR REPLACE FUNCTION public.apurar_ganhadores_para_match(p_match_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home int;
  v_away int;
  v_status text;
  v_inserted int := 0;
BEGIN
  SELECT home_score, away_score, status
    INTO v_home, v_away, v_status
  FROM public.matches
  WHERE id = p_match_id;

  IF v_status <> 'finished' OR v_home IS NULL OR v_away IS NULL THEN
    RETURN 0;
  END IF;

  WITH ins AS (
    INSERT INTO public.ganhadores (tenant_id, bolao_id, match_id, torcedor_id, palpite_id)
    SELECT p.tenant_id, p.bolao_id, p.match_id, p.torcedor_id, p.id
    FROM public.palpites p
    WHERE p.match_id = p_match_id
      AND p.status_pagamento = 'pago'
      AND p.palpite_a = v_home
      AND p.palpite_b = v_away
    ON CONFLICT (palpite_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_apurar_ganhadores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finished'
     AND NEW.home_score IS NOT NULL
     AND NEW.away_score IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR COALESCE(OLD.status, '') <> 'finished'
       OR COALESCE(OLD.home_score, -1) <> NEW.home_score
       OR COALESCE(OLD.away_score, -1) <> NEW.away_score
     )
  THEN
    PERFORM public.apurar_ganhadores_para_match(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apurar_ganhadores ON public.matches;
CREATE TRIGGER trg_apurar_ganhadores
AFTER INSERT OR UPDATE OF status, home_score, away_score ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.tg_apurar_ganhadores();

-- Backfill retroativo para jogos já finalizados
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.matches WHERE status = 'finished' AND home_score IS NOT NULL AND away_score IS NOT NULL LOOP
    PERFORM public.apurar_ganhadores_para_match(r.id);
  END LOOP;
END $$;
