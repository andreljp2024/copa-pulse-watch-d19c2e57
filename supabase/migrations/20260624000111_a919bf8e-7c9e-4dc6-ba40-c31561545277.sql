GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_pix_config TO authenticated;
GRANT ALL ON public.tenant_pix_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_whatsapp_config TO authenticated;
GRANT ALL ON public.tenant_whatsapp_config TO service_role;