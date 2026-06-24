DROP POLICY IF EXISTS "ganhadores read" ON public.ganhadores;

CREATE POLICY "ganhadores tenant read"
ON public.ganhadores
FOR SELECT
TO authenticated
USING (
  ((auth.uid() IS NOT NULL) AND (tenant_id = public.current_tenant_id()))
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);