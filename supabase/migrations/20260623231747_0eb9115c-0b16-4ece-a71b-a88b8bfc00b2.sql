
-- 1) Lock down SECURITY DEFINER helpers (used by triggers/RLS only)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_palpite_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- 2) Ganhadores: respect permitir_ganhadores_publico flag
DROP POLICY IF EXISTS "ganhadores public read" ON public.ganhadores;
CREATE POLICY "ganhadores read"
ON public.ganhadores
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.boloes b
    WHERE b.id = ganhadores.bolao_id
      AND b.permitir_ganhadores_publico = true
  )
  OR (auth.uid() IS NOT NULL AND tenant_id = public.current_tenant_id())
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- 3) Palpites: require non-null tenant for SELECT (closes NULL-tenant edge case)
DROP POLICY IF EXISTS "palpites tenant read" ON public.palpites;
CREATE POLICY "palpites tenant read"
ON public.palpites
FOR SELECT
TO authenticated
USING (
  (public.current_tenant_id() IS NOT NULL AND tenant_id = public.current_tenant_id())
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- 4) Torcedores: drop token_acesso from Realtime + revoke column-level SELECT
ALTER PUBLICATION supabase_realtime DROP TABLE public.torcedores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.torcedores (id, tenant_id, bolao_id, nome, whatsapp, created_at);

REVOKE SELECT ON public.torcedores FROM anon, authenticated;
GRANT SELECT (id, tenant_id, bolao_id, nome, whatsapp, created_at) ON public.torcedores TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.torcedores TO authenticated;
GRANT INSERT ON public.torcedores TO anon;

-- Also tighten SELECT policy with non-null tenant guard
DROP POLICY IF EXISTS "torcedores tenant read" ON public.torcedores;
CREATE POLICY "torcedores tenant read"
ON public.torcedores
FOR SELECT
TO authenticated
USING (
  (public.current_tenant_id() IS NOT NULL AND tenant_id = public.current_tenant_id())
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- 5) user_roles: only super_admin can mutate roles (prevents admin self-escalation)
DROP POLICY IF EXISTS user_roles_admin_insert ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_update ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_delete ON public.user_roles;
