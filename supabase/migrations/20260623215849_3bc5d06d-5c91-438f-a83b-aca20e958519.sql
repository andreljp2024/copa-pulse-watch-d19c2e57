
CREATE OR REPLACE FUNCTION public.enforce_palpite_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  SELECT p.limite_palpites
    INTO v_limit
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.tenant_id = NEW.tenant_id
    AND a.status = 'ativa'
    AND (a.data_fim IS NULL OR a.data_fim > now())
  ORDER BY a.data_inicio DESC
  LIMIT 1;

  IF v_limit IS NULL AND NOT FOUND THEN
    SELECT limite_palpites INTO v_limit
    FROM public.planos
    WHERE nome = 'Grátis' AND ativo = true
    LIMIT 1;
  END IF;

  -- NULL limit = unlimited
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.palpites
  WHERE tenant_id = NEW.tenant_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite de % palpites do plano atingido. Faça upgrade para continuar.', v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_palpite_limit ON public.palpites;
CREATE TRIGGER trg_enforce_palpite_limit
  BEFORE INSERT ON public.palpites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_palpite_limit();
