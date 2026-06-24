
ALTER TABLE public.tenant_whatsapp_config
  ADD COLUMN IF NOT EXISTS integracao_modo text NOT NULL DEFAULT 'link'
    CHECK (integracao_modo IN ('link','evolution_api')),
  ADD COLUMN IF NOT EXISTS evolution_base_url text,
  ADD COLUMN IF NOT EXISTS evolution_api_key text,
  ADD COLUMN IF NOT EXISTS evolution_instance text;
