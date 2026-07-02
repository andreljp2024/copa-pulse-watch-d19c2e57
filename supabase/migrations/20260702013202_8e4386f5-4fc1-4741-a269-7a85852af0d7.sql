
-- 1) Ajustar super_admin: apenas andreljp@gmail.com
DELETE FROM public.user_roles WHERE role = 'super_admin';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role FROM auth.users
WHERE lower(email) = 'andreljp@gmail.com' AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Trigger: atribuir papéis por padrão a novos usuários confirmados
CREATE OR REPLACE FUNCTION public.assign_default_roles_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Todo usuário confirmado vira organizador (tenant_admin)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'tenant_admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Super admin exclusivo para andreljp@gmail.com
  IF lower(NEW.email) = 'andreljp@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_roles ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_roles
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_default_roles_on_confirm();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_assign_roles ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_assign_roles
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.assign_default_roles_on_confirm();

-- Backfill: usuários já confirmados sem role de organizador
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'tenant_admin'::app_role FROM auth.users
WHERE email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Assinatura Grátis automática ao criar tenant
CREATE OR REPLACE FUNCTION public.assign_free_plan_on_tenant_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free_plan_id uuid;
BEGIN
  SELECT id INTO v_free_plan_id
  FROM public.planos
  WHERE nome = 'Grátis' AND ativo = true
  LIMIT 1;

  IF v_free_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.assinaturas (tenant_id, plano_id, status)
  VALUES (NEW.id, v_free_plan_id, 'ativa')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_tenant_free_plan ON public.tenants;
CREATE TRIGGER tg_tenant_free_plan
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.assign_free_plan_on_tenant_create();

-- Backfill: tenants sem assinatura ativa recebem plano Grátis
INSERT INTO public.assinaturas (tenant_id, plano_id, status)
SELECT t.id, (SELECT id FROM public.planos WHERE nome = 'Grátis' AND ativo = true LIMIT 1), 'ativa'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.assinaturas a
  WHERE a.tenant_id = t.id AND a.status = 'ativa'
);
