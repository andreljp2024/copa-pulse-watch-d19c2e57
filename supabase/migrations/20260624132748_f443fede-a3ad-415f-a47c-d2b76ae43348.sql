INSERT INTO public.user_roles (user_id, role)
SELECT 'f53a36b4-cfa4-47d0-9bd6-04ae8593672c'::uuid, 'super_admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id='f53a36b4-cfa4-47d0-9bd6-04ae8593672c' AND role='super_admin'
);