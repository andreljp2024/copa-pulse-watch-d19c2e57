
-- Enforce per-tenant bolão limit based on active plan (mirrors enforce_palpite_limit)
CREATE OR REPLACE FUNCTION public.enforce_bolao_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
  v_found boolean := false;
BEGIN
  -- Limite do plano ativo do tenant
  SELECT p.limite_boloes
    INTO v_limit
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.tenant_id = NEW.tenant_id
    AND a.status = 'ativa'
    AND (a.data_fim IS NULL OR a.data_fim > now())
  ORDER BY a.data_inicio DESC
  LIMIT 1;

  IF FOUND THEN v_found := true; END IF;

  -- Sem assinatura ativa: cair no plano Grátis
  IF NOT v_found THEN
    SELECT limite_boloes INTO v_limit
    FROM public.planos
    WHERE nome = 'Grátis' AND ativo = true
    LIMIT 1;
  END IF;

  -- NULL = ilimitado
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.boloes
  WHERE tenant_id = NEW.tenant_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite de % bolões do seu plano atingido. Faça upgrade para criar mais.', v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_bolao_limit ON public.boloes;
CREATE TRIGGER trg_enforce_bolao_limit
BEFORE INSERT ON public.boloes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_bolao_limit();
