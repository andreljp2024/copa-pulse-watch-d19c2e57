
-- 1) Drop overly broad public SELECT policies
DROP POLICY IF EXISTS "palpites public read" ON public.palpites;
DROP POLICY IF EXISTS "torcedores self read by token" ON public.torcedores;

-- 2) Tenant-owner SELECT policies
CREATE POLICY "palpites tenant read" ON public.palpites
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "torcedores tenant read" ON public.torcedores
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3) Public ranking RPC (safe aggregated columns only)
CREATE OR REPLACE FUNCTION public.get_bolao_ranking(p_slug text)
RETURNS TABLE (
  torcedor_id uuid,
  nome text,
  acertos_exatos bigint,
  acertos_resultado bigint,
  total bigint,
  pontos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH b AS (
    SELECT id FROM public.boloes WHERE slug = p_slug AND status = 'active' LIMIT 1
  ), scored AS (
    SELECT
      p.torcedor_id,
      (p.palpite_a = m.home_score AND p.palpite_b = m.away_score) AS exato,
      (sign(p.palpite_a - p.palpite_b) = sign(m.home_score - m.away_score)) AS res
    FROM public.palpites p
    JOIN public.matches m ON m.id = p.match_id AND m.status = 'finished'
    WHERE p.bolao_id = (SELECT id FROM b)
      AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
  )
  SELECT
    s.torcedor_id,
    t.nome,
    count(*) FILTER (WHERE s.exato) AS acertos_exatos,
    count(*) FILTER (WHERE NOT s.exato AND s.res) AS acertos_resultado,
    count(*)::bigint AS total,
    (10 * count(*) FILTER (WHERE s.exato) + 5 * count(*) FILTER (WHERE NOT s.exato AND s.res))::bigint AS pontos
  FROM scored s
  JOIN public.torcedores t ON t.id = s.torcedor_id
  GROUP BY s.torcedor_id, t.nome
  ORDER BY pontos DESC, acertos_exatos DESC;
$$;

REVOKE ALL ON FUNCTION public.get_bolao_ranking(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bolao_ranking(text) TO anon, authenticated;

-- 4) Submit-palpite RPC so anon doesn't need SELECT on torcedores/palpites
CREATE OR REPLACE FUNCTION public.submit_palpite(
  p_bolao_id uuid,
  p_nome text,
  p_whatsapp text,
  p_match_id uuid,
  p_palpite_a integer,
  p_palpite_b integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bolao public.boloes%ROWTYPE;
  v_torcedor_id uuid;
  v_palpite_id uuid;
  v_valor numeric(10,2);
BEGIN
  IF p_palpite_a < 0 OR p_palpite_b < 0 THEN
    RAISE EXCEPTION 'Palpite inválido';
  END IF;

  SELECT * INTO v_bolao FROM public.boloes WHERE id = p_bolao_id;
  IF NOT FOUND OR v_bolao.status <> 'active' THEN
    RAISE EXCEPTION 'Bolão indisponível';
  END IF;
  IF v_bolao.data_limite_palpite IS NOT NULL AND v_bolao.data_limite_palpite <= now() THEN
    RAISE EXCEPTION 'Prazo para palpites encerrado';
  END IF;

  v_valor := COALESCE(v_bolao.valor_palpite, 0);

  INSERT INTO public.torcedores (tenant_id, bolao_id, nome, whatsapp)
  VALUES (v_bolao.tenant_id, v_bolao.id, btrim(p_nome), p_whatsapp)
  ON CONFLICT (bolao_id, whatsapp) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_torcedor_id;

  INSERT INTO public.palpites (tenant_id, bolao_id, torcedor_id, match_id, palpite_a, palpite_b, valor)
  VALUES (v_bolao.tenant_id, v_bolao.id, v_torcedor_id, p_match_id, p_palpite_a, p_palpite_b, v_valor)
  RETURNING id INTO v_palpite_id;

  RETURN v_palpite_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_palpite(uuid, text, text, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_palpite(uuid, text, text, uuid, integer, integer) TO anon, authenticated;

-- 5) Restrict user_roles admin policy: admin cannot manage super_admin or own rows
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;

CREATE POLICY user_roles_admin_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND role <> 'super_admin'::app_role
    AND user_id <> auth.uid()
  );

CREATE POLICY user_roles_admin_update ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND role <> 'super_admin'::app_role
    AND user_id <> auth.uid()
  )
  WITH CHECK (
    role <> 'super_admin'::app_role
    AND user_id <> auth.uid()
  );

CREATE POLICY user_roles_admin_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND role <> 'super_admin'::app_role
    AND user_id <> auth.uid()
  );

CREATE POLICY user_roles_super_admin_all ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 6) Lock down SECURITY DEFINER functions executable surface
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_palpite_limit() FROM PUBLIC, anon, authenticated;
-- has_role is needed by RLS policies invoked by authenticated users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
