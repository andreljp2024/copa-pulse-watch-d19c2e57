
-- 1) Revogar EXECUTE de anon nas funções que NÃO devem ser públicas
REVOKE EXECUTE ON FUNCTION public.export_bolao(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_audit_log(int, int) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_fraud_signals() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_torcedor_bloqueado(uuid, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_organizador() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_dashboard_organizador() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_ranking() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_whatsapp_config(uuid, text, text, text, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM anon, PUBLIC;

-- Garantir que authenticated continua podendo chamar
GRANT EXECUTE ON FUNCTION public.export_bolao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_audit_log(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_fraud_signals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_torcedor_bloqueado(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_organizador() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_whatsapp_config(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;

-- 2) Bloquear acesso direto às materialized views via Data API
REVOKE ALL ON public.mv_ranking_torcedores FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.mv_dashboard_organizador FROM anon, authenticated, PUBLIC;
-- service_role e o dono continuam com acesso; RPCs SECURITY DEFINER leem normalmente
