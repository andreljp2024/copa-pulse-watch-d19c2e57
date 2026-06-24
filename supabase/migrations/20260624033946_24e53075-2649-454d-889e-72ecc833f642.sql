
-- 1. Restrict torcedores.token_acesso from being readable via the Data API
REVOKE SELECT ON public.torcedores FROM authenticated;
GRANT SELECT (id, tenant_id, bolao_id, nome, whatsapp, created_at) ON public.torcedores TO authenticated;

-- 2. Allow tenant owners to DELETE their own WhatsApp config
CREATE POLICY "Tenant owners delete own whatsapp config"
ON public.tenant_whatsapp_config
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenants t
  WHERE t.id = tenant_whatsapp_config.tenant_id
    AND t.owner_user_id = auth.uid()
));

-- 3. Allow tenant owners to DELETE their own Pix config
CREATE POLICY "Tenant owners delete own pix config"
ON public.tenant_pix_config
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenants t
  WHERE t.id = tenant_pix_config.tenant_id
    AND t.owner_user_id = auth.uid()
));

-- 4. Lock down SECURITY DEFINER functions to least privilege
-- Trigger-only functions: no direct callers needed
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_palpite_limit() FROM PUBLIC, anon, authenticated;

-- Helper functions used inside RLS policies: authenticated only, not anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;

-- Public-facing RPCs (intentionally callable by anon for public bolão pages)
-- get_bolao_ranking & submit_palpite stay executable by anon/authenticated.
