
-- ============================================================
-- Fila de notificações WhatsApp
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bolao_id uuid REFERENCES public.boloes(id) ON DELETE CASCADE,
  torcedor_id uuid REFERENCES public.torcedores(id) ON DELETE CASCADE,
  palpite_id uuid REFERENCES public.palpites(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('ganhador','confirmacao_pagamento','lembrete_pagamento','novo_palpite','custom')),
  numero_whatsapp text NOT NULL,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','skipped')),
  tentativas int NOT NULL DEFAULT 0,
  ultimo_erro text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_queue_status_scheduled
  ON public.notification_queue (status, scheduled_at)
  WHERE status IN ('pending','sending');

CREATE INDEX IF NOT EXISTS idx_notif_queue_tenant
  ON public.notification_queue (tenant_id, created_at DESC);

GRANT SELECT ON public.notification_queue TO authenticated;
GRANT ALL ON public.notification_queue TO service_role;

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant vê própria fila"
  ON public.notification_queue FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP TRIGGER IF EXISTS tg_notif_queue_updated_at ON public.notification_queue;
CREATE TRIGGER tg_notif_queue_updated_at
  BEFORE UPDATE ON public.notification_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- Enfileirar mensagem quando um ganhador é registrado
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_enqueue_ganhador_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template text;
  v_numero text;
  v_nome_bolao text;
  v_nome_torcedor text;
  v_whats_torcedor text;
  v_palpite_a int;
  v_palpite_b int;
  v_valor numeric;
  v_home_score int;
  v_away_score int;
  v_home_name text;
  v_away_name text;
  v_home_flag text;
  v_away_flag text;
  v_mensagem text;
BEGIN
  SELECT wa.mensagem_ganhador, wa.numero_whatsapp
    INTO v_template, v_numero
  FROM public.tenant_whatsapp_config wa
  WHERE wa.tenant_id = NEW.tenant_id;

  SELECT b.nome INTO v_nome_bolao FROM public.boloes b WHERE b.id = NEW.bolao_id;

  SELECT t.nome, t.whatsapp INTO v_nome_torcedor, v_whats_torcedor
  FROM public.torcedores t WHERE t.id = NEW.torcedor_id;

  SELECT p.palpite_a, p.palpite_b, p.valor
    INTO v_palpite_a, v_palpite_b, v_valor
  FROM public.palpites p WHERE p.id = NEW.palpite_id;

  SELECT m.home_score, m.away_score, ht.name, at.name, ht.flag_url, at.flag_url
    INTO v_home_score, v_away_score, v_home_name, v_away_name, v_home_flag, v_away_flag
  FROM public.matches m
  LEFT JOIN public.teams ht ON ht.id = m.home_team_id
  LEFT JOIN public.teams at ON at.id = m.away_team_id
  WHERE m.id = NEW.match_id;

  IF v_whats_torcedor IS NULL OR length(regexp_replace(v_whats_torcedor,'\D','','g')) < 10 THEN
    RETURN NEW;
  END IF;

  v_template := COALESCE(v_template,
    '🏆 Parabéns, {{nome_torcedor}}! Você cravou o placar {{selecao_a}} {{placar_a}} x {{placar_b}} {{selecao_b}} no {{nome_bolao}}. Em breve entramos em contato para o prêmio.');

  v_mensagem := replace(v_template, '{{nome_torcedor}}', COALESCE(v_nome_torcedor,''));
  v_mensagem := replace(v_mensagem, '{{nome_bolao}}', COALESCE(v_nome_bolao,''));
  v_mensagem := replace(v_mensagem, '{{selecao_a}}', COALESCE(v_home_name,''));
  v_mensagem := replace(v_mensagem, '{{selecao_b}}', COALESCE(v_away_name,''));
  v_mensagem := replace(v_mensagem, '{{bandeira_a}}', COALESCE(v_home_flag,''));
  v_mensagem := replace(v_mensagem, '{{bandeira_b}}', COALESCE(v_away_flag,''));
  v_mensagem := replace(v_mensagem, '{{placar_a}}', COALESCE(v_home_score::text,''));
  v_mensagem := replace(v_mensagem, '{{placar_b}}', COALESCE(v_away_score::text,''));
  v_mensagem := replace(v_mensagem, '{{palpite_a}}', COALESCE(v_palpite_a::text,''));
  v_mensagem := replace(v_mensagem, '{{palpite_b}}', COALESCE(v_palpite_b::text,''));
  v_mensagem := replace(v_mensagem, '{{valor_palpite}}', COALESCE(v_valor::text,''));

  INSERT INTO public.notification_queue (
    tenant_id, bolao_id, torcedor_id, palpite_id, tipo, numero_whatsapp, mensagem
  ) VALUES (
    NEW.tenant_id, NEW.bolao_id, NEW.torcedor_id, NEW.palpite_id,
    'ganhador', v_whats_torcedor, v_mensagem
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_enqueue_ganhador_notif ON public.ganhadores;
CREATE TRIGGER tg_enqueue_ganhador_notif
  AFTER INSERT ON public.ganhadores
  FOR EACH ROW EXECUTE FUNCTION public.tg_enqueue_ganhador_notif();

-- ============================================================
-- Índices de performance para o painel
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_palpites_tenant_status
  ON public.palpites (tenant_id, status_pagamento);

CREATE INDEX IF NOT EXISTS idx_palpites_tenant_created
  ON public.palpites (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff
  ON public.matches (kickoff_at);

CREATE INDEX IF NOT EXISTS idx_ganhadores_tenant
  ON public.ganhadores (tenant_id, created_at DESC);
