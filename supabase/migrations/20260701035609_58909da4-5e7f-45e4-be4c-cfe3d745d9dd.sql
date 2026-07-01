
DROP FUNCTION IF EXISTS public.get_bolao_public_payment(text);
CREATE OR REPLACE FUNCTION public.get_bolao_public_payment(p_slug text)
 RETURNS TABLE(nome_recebedor text, chave_pix text, banco text, valor_padrao_palpite numeric, numero_whatsapp text, mensagem_novo_palpite text, numero_recebedor_whatsapp text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    px.nome_recebedor,
    px.chave_pix,
    px.banco,
    px.valor_padrao_palpite,
    wa.numero_whatsapp,
    wa.mensagem_novo_palpite,
    px.numero_recebedor_whatsapp
  FROM public.boloes b
  LEFT JOIN public.tenant_pix_config px ON px.tenant_id = b.tenant_id
  LEFT JOIN public.tenant_whatsapp_config wa ON wa.tenant_id = b.tenant_id
  WHERE b.slug = p_slug AND b.status = 'active'
  LIMIT 1;
$$;
