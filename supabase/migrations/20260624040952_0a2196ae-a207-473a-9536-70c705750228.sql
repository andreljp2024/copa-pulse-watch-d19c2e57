
-- 1) palpites_anon_torcedor_validation: force anon writes through submit_palpite() RPC
DROP POLICY IF EXISTS "palpites anon insert" ON public.palpites;
DROP POLICY IF EXISTS "torcedores anon insert" ON public.torcedores;
REVOKE INSERT ON public.palpites FROM anon;
REVOKE INSERT ON public.torcedores FROM anon;

-- 2) tenant_whatsapp_config_api_key_exposure: hide secret columns from Data API
REVOKE SELECT ON public.tenant_whatsapp_config FROM authenticated;
GRANT SELECT (
  id, tenant_id, numero_whatsapp,
  mensagem_novo_palpite, mensagem_confirmacao_pagamento,
  mensagem_ganhador, mensagem_lembrete_pagamento,
  created_at, updated_at, integracao_modo, evolution_instance
) ON public.tenant_whatsapp_config TO authenticated;
-- evolution_base_url and evolution_api_key are intentionally excluded from SELECT;
-- writes (INSERT/UPDATE) remain allowed and gated by existing RLS policies.

-- 3) torcedores_token_acesso_exposure: store token hashed; raw token only at creation
ALTER TABLE public.torcedores
  ADD COLUMN IF NOT EXISTS token_acesso_hash text;

CREATE OR REPLACE FUNCTION public.tg_hash_torcedor_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.token_acesso IS NOT NULL AND NEW.token_acesso <> '' THEN
    NEW.token_acesso_hash := encode(digest(NEW.token_acesso, 'sha256'), 'hex');
  END IF;
  -- never persist raw token
  NEW.token_acesso := NULL;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_hash_torcedor_token() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS torcedores_hash_token ON public.torcedores;
CREATE TRIGGER torcedores_hash_token
  BEFORE INSERT OR UPDATE OF token_acesso ON public.torcedores
  FOR EACH ROW EXECUTE FUNCTION public.tg_hash_torcedor_token();

-- Backfill: hash existing tokens, clear plaintext
UPDATE public.torcedores
SET token_acesso_hash = COALESCE(token_acesso_hash, encode(digest(token_acesso, 'sha256'), 'hex')),
    token_acesso = NULL
WHERE token_acesso IS NOT NULL;
