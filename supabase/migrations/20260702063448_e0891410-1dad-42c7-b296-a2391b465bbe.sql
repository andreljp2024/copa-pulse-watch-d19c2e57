
-- Trigger no lado dos palpites: se o jogo já está finalizado e o palpite bateu, insere ganhador
CREATE OR REPLACE FUNCTION public.tg_apurar_ganhador_palpite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home int;
  v_away int;
  v_status text;
BEGIN
  IF NEW.status_pagamento <> 'pago' THEN
    RETURN NEW;
  END IF;

  SELECT home_score, away_score, status INTO v_home, v_away, v_status
  FROM public.matches WHERE id = NEW.match_id;

  IF v_status = 'finished' AND v_home IS NOT NULL AND v_away IS NOT NULL
     AND NEW.palpite_a = v_home AND NEW.palpite_b = v_away THEN
    INSERT INTO public.ganhadores (tenant_id, bolao_id, match_id, torcedor_id, palpite_id)
    VALUES (NEW.tenant_id, NEW.bolao_id, NEW.match_id, NEW.torcedor_id, NEW.id)
    ON CONFLICT (palpite_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apurar_ganhador_palpite ON public.palpites;
CREATE TRIGGER trg_apurar_ganhador_palpite
AFTER INSERT OR UPDATE OF status_pagamento, palpite_a, palpite_b, match_id
ON public.palpites
FOR EACH ROW EXECUTE FUNCTION public.tg_apurar_ganhador_palpite();

-- Backfill: reprocessa todos os jogos finalizados
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.matches WHERE status = 'finished'
           AND home_score IS NOT NULL AND away_score IS NOT NULL
  LOOP
    PERFORM public.apurar_ganhadores_para_match(r.id);
  END LOOP;
END $$;
