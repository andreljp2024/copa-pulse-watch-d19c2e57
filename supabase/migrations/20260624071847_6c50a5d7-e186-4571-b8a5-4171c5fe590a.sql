
-- Lock down public.user_roles at the table-level GRANTs so authenticated users
-- can only read; mutations require service_role (or super_admin via SECURITY DEFINER fns).
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Add an explicit RESTRICTIVE policy: even if a future GRANT slips in,
-- inserts/updates/deletes must originate from a super_admin OR service_role.
DROP POLICY IF EXISTS user_roles_block_self_escalation ON public.user_roles;
CREATE POLICY user_roles_block_self_escalation
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
