
DROP POLICY IF EXISTS "torcedores anon insert" ON public.torcedores;
CREATE POLICY "torcedores anon insert" ON public.torcedores FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.boloes b
    WHERE b.id = bolao_id
      AND b.status = 'active'
      AND b.tenant_id = torcedores.tenant_id
  )
);

DROP POLICY IF EXISTS "palpites anon insert" ON public.palpites;
CREATE POLICY "palpites anon insert" ON public.palpites FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.torcedores t
    JOIN public.boloes b ON b.id = t.bolao_id
    WHERE t.id = torcedor_id
      AND t.bolao_id = palpites.bolao_id
      AND t.tenant_id = palpites.tenant_id
      AND b.status = 'active'
      AND (b.data_limite_palpite IS NULL OR b.data_limite_palpite > now())
  )
);
