
-- 1) tenant_pix_config: campo faltante
ALTER TABLE public.tenant_pix_config
  ADD COLUMN IF NOT EXISTS numero_recebedor_whatsapp text;

-- 2) Adicionar round_of_32 ao enum de phases (Copa 2026 - 48 times)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'match_phase' AND e.enumlabel = 'round_of_32'
  ) THEN
    ALTER TYPE public.match_phase ADD VALUE IF NOT EXISTS 'round_of_32' BEFORE 'round_of_16';
  END IF;
END $$;

-- 3) Adicionar super_admin ao app_role
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
  END IF;
END $$;

-- 4) Tabela scorers (artilheiros)
CREATE TABLE IF NOT EXISTS public.scorers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  team_code text NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  goals integer NOT NULL DEFAULT 0,
  assists integer NOT NULL DEFAULT 0,
  penalties integer NOT NULL DEFAULT 0,
  nationality text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scorers TO anon, authenticated;
GRANT ALL ON public.scorers TO service_role;
ALTER TABLE public.scorers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scorers_public_read" ON public.scorers FOR SELECT USING (true);

-- 5) evolution_credentials
CREATE TABLE IF NOT EXISTS public.evolution_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gestor_id uuid NOT NULL,
  instance_id text NOT NULL UNIQUE,
  api_key text NOT NULL,
  qr_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gestor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evolution_credentials TO authenticated;
GRANT ALL ON public.evolution_credentials TO service_role;
ALTER TABLE public.evolution_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evo_owner_all" ON public.evolution_credentials FOR ALL TO authenticated
  USING (gestor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (gestor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 6) notifications (admin)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_admin_all" ON public.notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7) upsert_whatsapp_config RPC
CREATE OR REPLACE FUNCTION public.upsert_whatsapp_config(
  p_tenant_id uuid,
  p_numero_whatsapp text,
  p_mensagem_novo_palpite text DEFAULT NULL,
  p_mensagem_confirmacao_pagamento text DEFAULT NULL,
  p_mensagem_ganhador text DEFAULT NULL,
  p_mensagem_lembrete_pagamento text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id = p_tenant_id AND owner_user_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized to update this tenant';
  END IF;

  INSERT INTO public.tenant_whatsapp_config (
    tenant_id, numero_whatsapp,
    mensagem_novo_palpite, mensagem_confirmacao_pagamento,
    mensagem_ganhador, mensagem_lembrete_pagamento
  ) VALUES (
    p_tenant_id, p_numero_whatsapp,
    p_mensagem_novo_palpite, p_mensagem_confirmacao_pagamento,
    p_mensagem_ganhador, p_mensagem_lembrete_pagamento
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    numero_whatsapp = EXCLUDED.numero_whatsapp,
    mensagem_novo_palpite = COALESCE(EXCLUDED.mensagem_novo_palpite, public.tenant_whatsapp_config.mensagem_novo_palpite),
    mensagem_confirmacao_pagamento = COALESCE(EXCLUDED.mensagem_confirmacao_pagamento, public.tenant_whatsapp_config.mensagem_confirmacao_pagamento),
    mensagem_ganhador = COALESCE(EXCLUDED.mensagem_ganhador, public.tenant_whatsapp_config.mensagem_ganhador),
    mensagem_lembrete_pagamento = COALESCE(EXCLUDED.mensagem_lembrete_pagamento, public.tenant_whatsapp_config.mensagem_lembrete_pagamento),
    updated_at = now();
END;
$$;

-- triggers de updated_at
DROP TRIGGER IF EXISTS trg_scorers_updated_at ON public.scorers;
CREATE TRIGGER trg_scorers_updated_at BEFORE UPDATE ON public.scorers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_evo_updated_at ON public.evolution_credentials;
CREATE TRIGGER trg_evo_updated_at BEFORE UPDATE ON public.evolution_credentials
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
