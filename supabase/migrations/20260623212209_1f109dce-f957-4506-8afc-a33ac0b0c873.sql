
-- TENANTS
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_responsavel text NOT NULL,
  nome_estabelecimento text NOT NULL,
  cpf_cnpj text,
  email text NOT NULL,
  whatsapp text,
  cidade text,
  estado text,
  logo_url text,
  status text NOT NULL DEFAULT 'active',
  plano text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.tenants WHERE owner_user_id = auth.uid() LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;

CREATE POLICY "tenant owner reads own"  ON public.tenants FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant owner inserts own" ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "tenant owner updates own" ON public.tenants FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admin deletes tenants" ON public.tenants FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- PIX CONFIG
CREATE TABLE public.tenant_pix_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome_recebedor text NOT NULL,
  tipo_chave_pix text NOT NULL CHECK (tipo_chave_pix IN ('cpf','cnpj','email','telefone','aleatoria')),
  chave_pix text NOT NULL,
  banco text,
  cidade text,
  valor_padrao_palpite numeric(10,2) NOT NULL DEFAULT 10.00,
  instrucoes_pagamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_pix_config TO authenticated;
GRANT ALL ON public.tenant_pix_config TO service_role;
ALTER TABLE public.tenant_pix_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pix tenant access" ON public.tenant_pix_config FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

-- WHATSAPP CONFIG
CREATE TABLE public.tenant_whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  numero_whatsapp text NOT NULL,
  mensagem_novo_palpite text,
  mensagem_confirmacao_pagamento text,
  mensagem_ganhador text,
  mensagem_lembrete_pagamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_whatsapp_config TO authenticated;
GRANT ALL ON public.tenant_whatsapp_config TO service_role;
ALTER TABLE public.tenant_whatsapp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa tenant access" ON public.tenant_whatsapp_config FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

-- BOLOES
CREATE TABLE public.boloes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  descricao text,
  regras text,
  valor_palpite numeric(10,2) NOT NULL DEFAULT 10.00,
  status text NOT NULL DEFAULT 'active',
  logo_url text,
  cor_primaria text DEFAULT '#0f766e',
  cor_secundaria text DEFAULT '#fbbf24',
  permitir_ranking_publico boolean NOT NULL DEFAULT true,
  permitir_ganhadores_publico boolean NOT NULL DEFAULT true,
  data_limite_palpite timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX boloes_tenant_idx ON public.boloes(tenant_id);
CREATE INDEX boloes_slug_idx ON public.boloes(slug);
GRANT SELECT ON public.boloes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boloes TO authenticated;
GRANT ALL ON public.boloes TO service_role;
ALTER TABLE public.boloes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boloes public read" ON public.boloes FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "boloes tenant insert" ON public.boloes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "boloes tenant update" ON public.boloes FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "boloes tenant delete" ON public.boloes FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

-- TORCEDORES
CREATE TABLE public.torcedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bolao_id uuid NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  whatsapp text NOT NULL,
  token_acesso text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX torcedores_bolao_idx ON public.torcedores(bolao_id);
GRANT SELECT, INSERT ON public.torcedores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.torcedores TO authenticated;
GRANT ALL ON public.torcedores TO service_role;
ALTER TABLE public.torcedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "torcedores anon insert" ON public.torcedores FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "torcedores self read by token" ON public.torcedores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "torcedores tenant update" ON public.torcedores FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "torcedores tenant delete" ON public.torcedores FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

-- PALPITES
CREATE TABLE public.palpites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bolao_id uuid NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  torcedor_id uuid NOT NULL REFERENCES public.torcedores(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  palpite_a int NOT NULL CHECK (palpite_a >= 0),
  palpite_b int NOT NULL CHECK (palpite_b >= 0),
  valor numeric(10,2) NOT NULL DEFAULT 0,
  status_pagamento text NOT NULL DEFAULT 'pendente' CHECK (status_pagamento IN ('pendente','pago','cancelado')),
  status_palpite text NOT NULL DEFAULT 'aberto' CHECK (status_palpite IN ('aberto','ganhador','perdedor')),
  comprovante_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (torcedor_id, match_id)
);
CREATE INDEX palpites_bolao_idx ON public.palpites(bolao_id);
CREATE INDEX palpites_match_idx ON public.palpites(match_id);
GRANT SELECT, INSERT ON public.palpites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.palpites TO authenticated;
GRANT ALL ON public.palpites TO service_role;
ALTER TABLE public.palpites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "palpites anon insert" ON public.palpites FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "palpites public read" ON public.palpites FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "palpites tenant update" ON public.palpites FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "palpites tenant delete" ON public.palpites FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

-- GANHADORES
CREATE TABLE public.ganhadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bolao_id uuid NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  torcedor_id uuid NOT NULL REFERENCES public.torcedores(id) ON DELETE CASCADE,
  palpite_id uuid NOT NULL REFERENCES public.palpites(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ganhadores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ganhadores TO authenticated;
GRANT ALL ON public.ganhadores TO service_role;
ALTER TABLE public.ganhadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ganhadores public read" ON public.ganhadores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ganhadores tenant write" ON public.ganhadores FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "ganhadores tenant delete" ON public.ganhadores FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

-- PLANOS
CREATE TABLE public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  limite_boloes int,
  limite_torcedores int,
  limite_palpites int,
  permite_logo boolean NOT NULL DEFAULT false,
  permite_exportacao boolean NOT NULL DEFAULT false,
  permite_whatsapp_api boolean NOT NULL DEFAULT false,
  permite_dominio_personalizado boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.planos TO anon, authenticated;
GRANT ALL ON public.planos TO service_role;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planos public read" ON public.planos FOR SELECT TO anon, authenticated USING (ativo = true);
CREATE POLICY "planos super admin write" ON public.planos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ASSINATURAS
CREATE TABLE public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.planos(id),
  status text NOT NULL DEFAULT 'ativa',
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_fim timestamptz,
  gateway_pagamento text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas TO authenticated;
GRANT ALL ON public.assinaturas TO service_role;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assinaturas tenant access" ON public.assinaturas FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

-- triggers
CREATE TRIGGER tg_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_pix_updated BEFORE UPDATE ON public.tenant_pix_config FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_wa_updated BEFORE UPDATE ON public.tenant_whatsapp_config FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_boloes_updated BEFORE UPDATE ON public.boloes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_palpites_updated BEFORE UPDATE ON public.palpites FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- seed
INSERT INTO public.planos (nome, preco, limite_boloes, limite_torcedores, limite_palpites, permite_logo, permite_exportacao, permite_whatsapp_api, permite_dominio_personalizado) VALUES
('Grátis',   0.00,  1, 50,   100,  false, false, false, false),
('Básico',  29.90,  1, 300,  1000, true,  true,  false, false),
('Pro',     79.90,  NULL, NULL, NULL, true, true, false, false),
('Premium',149.90,  NULL, NULL, NULL, true, true, true,  true);
