
DROP FUNCTION IF EXISTS public.get_dashboard_organizador();

CREATE OR REPLACE FUNCTION public.get_dashboard_organizador()
RETURNS TABLE(
  tenant_id uuid,
  total_boloes bigint,
  boloes_ativos bigint,
  total_torcedores bigint,
  torcedores_bloqueados bigint,
  total_palpites bigint,
  palpites_pagos bigint,
  palpites_pendentes bigint,
  receita_paga numeric,
  receita_pendente numeric,
  total_ganhadores bigint,
  palpites_7d bigint,
  refreshed_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT mv.tenant_id, mv.total_boloes, mv.boloes_ativos, mv.total_torcedores,
         mv.torcedores_bloqueados, mv.total_palpites, mv.palpites_pagos,
         mv.palpites_pendentes, mv.receita_paga, mv.receita_pendente,
         mv.total_ganhadores, mv.palpites_7d, mv.refreshed_at
  FROM private.mv_dashboard_organizador mv
  JOIN public.tenants t ON t.id = mv.tenant_id
  WHERE t.owner_user_id = auth.uid()
     OR public.has_role(auth.uid(), 'super_admin');
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_organizador() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_organizador() TO authenticated;
