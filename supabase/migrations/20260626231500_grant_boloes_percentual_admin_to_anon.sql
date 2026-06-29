-- Allow the public bolao page to calculate estimated prize without exposing
-- broad table access to anon.
GRANT SELECT (percentual_admin) ON public.boloes TO anon;
