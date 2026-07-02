
-- Alinhar plano Grátis com a nova proposta: todos os recursos até 50 palpites
UPDATE public.planos
SET
  preco = 0,
  limite_palpites = 50,
  limite_boloes = NULL,
  limite_torcedores = NULL,
  permite_logo = true,
  permite_exportacao = true,
  permite_whatsapp_api = true,
  permite_dominio_personalizado = false,
  ativo = true
WHERE nome = 'Grátis';

-- Desativar planos pagos legados (novo modelo é "Grátis" + "Consulte o Dev")
UPDATE public.planos
SET ativo = false
WHERE nome IN ('Básico', 'Intermediário', 'Ilimitado');
