
-- Audit log: registra ações sensíveis no sistema
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,           -- INSERT | UPDATE | DELETE | CUSTOM
  entity text NOT NULL,           -- nome da tabela ou domínio
  entity_id text,
  before jsonb,
  after jsonb,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_tenant_created ON public.audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_log(entity, entity_id);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner e super admin leem auditoria"
ON public.audit_log FOR SELECT TO authenticated
USING (
  (tenant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = audit_log.tenant_id AND t.owner_user_id = auth.uid()
  ))
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Trigger genérico de auditoria
CREATE OR REPLACE FUNCTION public.tg_audit_generic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_id text;
  v_email text;
BEGIN
  BEGIN
    v_tenant := COALESCE((NEW).tenant_id, (OLD).tenant_id);
  EXCEPTION WHEN undefined_column THEN v_tenant := NULL;
  END;
  BEGIN
    v_id := COALESCE((NEW).id::text, (OLD).id::text);
  EXCEPTION WHEN undefined_column THEN v_id := NULL;
  END;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_log(tenant_id, actor_user_id, actor_email, action, entity, entity_id, before, after)
  VALUES (
    v_tenant, auth.uid(), v_email, TG_OP, TG_TABLE_NAME, v_id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Anexa aos alvos sensíveis
CREATE TRIGGER audit_boloes AFTER INSERT OR UPDATE OR DELETE ON public.boloes
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_generic();
CREATE TRIGGER audit_tenants AFTER UPDATE OR DELETE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_generic();
CREATE TRIGGER audit_assinaturas AFTER INSERT OR UPDATE OR DELETE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_generic();
CREATE TRIGGER audit_user_roles AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_generic();
CREATE TRIGGER audit_torcedores_bloqueio AFTER UPDATE OF bloqueado ON public.torcedores
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_generic();
CREATE TRIGGER audit_pix AFTER INSERT OR UPDATE OR DELETE ON public.tenant_pix_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_generic();
CREATE TRIGGER audit_whatsapp AFTER INSERT OR UPDATE OR DELETE ON public.tenant_whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_generic();

-- RPC de leitura paginada
CREATE OR REPLACE FUNCTION public.list_audit_log(p_limit int DEFAULT 100, p_offset int DEFAULT 0)
RETURNS SETOF public.audit_log
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.audit_log
  WHERE (tenant_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE t.id = audit_log.tenant_id AND t.owner_user_id = auth.uid()
        ))
     OR public.has_role(auth.uid(), 'super_admin')
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500))
  OFFSET GREATEST(0, p_offset);
$$;

-- Custom audit event (para eventos que não são DML)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_tenant_id uuid, p_action text, p_entity text, p_entity_id text DEFAULT NULL, p_meta jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  IF p_tenant_id IS NOT NULL AND NOT (
    EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id AND owner_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  ) THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.audit_log(tenant_id, actor_user_id, actor_email, action, entity, entity_id, meta)
  VALUES (p_tenant_id, auth.uid(), v_email, p_action, p_entity, p_entity_id, p_meta);
END; $$;

-- Backup: exporta bolão completo (JSON)
CREATE OR REPLACE FUNCTION public.export_bolao(p_bolao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_tenant uuid; v_result jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.boloes WHERE id = p_bolao_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Bolão não encontrado'; END IF;
  IF NOT (EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant AND owner_user_id = auth.uid())
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT jsonb_build_object(
    'version', 1,
    'exported_at', now(),
    'bolao', (SELECT to_jsonb(b) FROM public.boloes b WHERE b.id = p_bolao_id),
    'bolao_matches', COALESCE((SELECT jsonb_agg(to_jsonb(bm)) FROM public.bolao_matches bm WHERE bm.bolao_id = p_bolao_id), '[]'::jsonb),
    'torcedores', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.torcedores t WHERE t.bolao_id = p_bolao_id), '[]'::jsonb),
    'palpites', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.palpites p WHERE p.bolao_id = p_bolao_id), '[]'::jsonb),
    'ganhadores', COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM public.ganhadores g WHERE g.bolao_id = p_bolao_id), '[]'::jsonb)
  ) INTO v_result;

  INSERT INTO public.audit_log(tenant_id, actor_user_id, action, entity, entity_id, meta)
  VALUES (v_tenant, auth.uid(), 'EXPORT', 'boloes', p_bolao_id::text,
          jsonb_build_object('palpites', jsonb_array_length(v_result->'palpites')));

  RETURN v_result;
END; $$;
