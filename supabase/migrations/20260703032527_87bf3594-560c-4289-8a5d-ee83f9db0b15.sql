
-- ===== G. Materialized View: Dashboard do Organizador =====
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_dashboard_organizador AS
SELECT
  t.id AS tenant_id,
  (SELECT count(*) FROM public.boloes b WHERE b.tenant_id = t.id) AS total_boloes,
  (SELECT count(*) FROM public.boloes b WHERE b.tenant_id = t.id AND b.status = 'active') AS boloes_ativos,
  (SELECT count(*) FROM public.torcedores tc WHERE tc.tenant_id = t.id) AS total_torcedores,
  (SELECT count(*) FROM public.torcedores tc WHERE tc.tenant_id = t.id AND tc.bloqueado = true) AS torcedores_bloqueados,
  (SELECT count(*) FROM public.palpites p WHERE p.tenant_id = t.id) AS total_palpites,
  (SELECT count(*) FROM public.palpites p WHERE p.tenant_id = t.id AND p.status_pagamento = 'pago') AS palpites_pagos,
  (SELECT count(*) FROM public.palpites p WHERE p.tenant_id = t.id AND p.status_pagamento = 'pendente') AS palpites_pendentes,
  (SELECT COALESCE(sum(valor),0) FROM public.palpites p WHERE p.tenant_id = t.id AND p.status_pagamento = 'pago') AS receita_paga,
  (SELECT COALESCE(sum(valor),0) FROM public.palpites p WHERE p.tenant_id = t.id AND p.status_pagamento = 'pendente') AS receita_pendente,
  (SELECT count(*) FROM public.ganhadores g WHERE g.tenant_id = t.id) AS total_ganhadores,
  (SELECT count(*) FROM public.palpites p WHERE p.tenant_id = t.id AND p.created_at > now() - interval '7 days') AS palpites_7d,
  now() AS refreshed_at
FROM public.tenants t;

CREATE UNIQUE INDEX IF NOT EXISTS mv_dashboard_organizador_tenant_key
  ON public.mv_dashboard_organizador (tenant_id);

CREATE OR REPLACE FUNCTION public.refresh_dashboard_organizador()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_dashboard_organizador; END; $$;

-- RPC segura para o organizador ler o próprio dashboard
CREATE OR REPLACE FUNCTION public.get_dashboard_organizador()
RETURNS SETOF public.mv_dashboard_organizador
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT mv.* FROM public.mv_dashboard_organizador mv
  JOIN public.tenants t ON t.id = mv.tenant_id
  WHERE t.owner_user_id = auth.uid()
     OR public.has_role(auth.uid(), 'super_admin');
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_organizador() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_organizador() TO service_role;

-- Agendar refresh a cada 5 minutos
SELECT cron.unschedule('refresh-dashboard-organizador') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-dashboard-organizador'
);
SELECT cron.schedule('refresh-dashboard-organizador','*/5 * * * *',
  $$ SELECT public.refresh_dashboard_organizador(); $$);

-- ===== F. RPCs de segurança/painel de fraude =====
-- Lista sinais de fraude escopados aos bolões do organizador logado
CREATE OR REPLACE FUNCTION public.list_fraud_signals()
RETURNS TABLE(
  torcedor_id uuid, bolao_id uuid, nome text, whatsapp text,
  total_palpites bigint, pendentes bigint, ultimos_10min bigint,
  bloqueado boolean, bolao_nome text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fs.torcedor_id, fs.bolao_id, fs.nome, fs.whatsapp,
    fs.total_palpites, fs.pendentes, fs.ultimos_10min, fs.bloqueado,
    b.nome
  FROM public.fraud_signals fs
  JOIN public.boloes b ON b.id = fs.bolao_id
  JOIN public.tenants t ON t.id = b.tenant_id
  WHERE t.owner_user_id = auth.uid()
     OR public.has_role(auth.uid(), 'super_admin')
  ORDER BY fs.ultimos_10min DESC NULLS LAST, fs.pendentes DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.set_torcedor_bloqueado(p_torcedor_id uuid, p_bloqueado boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.torcedores WHERE id = p_torcedor_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Torcedor não encontrado'; END IF;
  IF NOT (EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant AND owner_user_id = auth.uid())
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  UPDATE public.torcedores SET bloqueado = p_bloqueado WHERE id = p_torcedor_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.list_fraud_signals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_torcedor_bloqueado(uuid, boolean) TO authenticated;

-- Popular a MV imediatamente
REFRESH MATERIALIZED VIEW public.mv_dashboard_organizador;
