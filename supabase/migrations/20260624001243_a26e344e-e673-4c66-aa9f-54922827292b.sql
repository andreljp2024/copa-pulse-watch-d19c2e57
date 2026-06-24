GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "pix tenant access" ON public.tenant_pix_config;
CREATE POLICY "pix tenant read"
ON public.tenant_pix_config
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_pix_config.tenant_id
      AND t.owner_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "pix tenant insert"
ON public.tenant_pix_config
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_pix_config.tenant_id
      AND t.owner_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "pix tenant update"
ON public.tenant_pix_config
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_pix_config.tenant_id
      AND t.owner_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_pix_config.tenant_id
      AND t.owner_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "pix tenant delete"
ON public.tenant_pix_config
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "wa tenant access" ON public.tenant_whatsapp_config;
CREATE POLICY "wa tenant read"
ON public.tenant_whatsapp_config
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_whatsapp_config.tenant_id
      AND t.owner_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "wa tenant insert"
ON public.tenant_whatsapp_config
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_whatsapp_config.tenant_id
      AND t.owner_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "wa tenant update"
ON public.tenant_whatsapp_config
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_whatsapp_config.tenant_id
      AND t.owner_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_whatsapp_config.tenant_id
      AND t.owner_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "wa tenant delete"
ON public.tenant_whatsapp_config
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));