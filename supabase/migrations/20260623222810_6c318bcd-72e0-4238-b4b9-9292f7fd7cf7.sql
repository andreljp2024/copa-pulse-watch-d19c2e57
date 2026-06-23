DELETE FROM public.torcedores t
USING public.torcedores t2
WHERE t.bolao_id = t2.bolao_id
  AND t.whatsapp = t2.whatsapp
  AND t.created_at > t2.created_at;

ALTER TABLE public.torcedores
  ADD CONSTRAINT torcedores_bolao_whatsapp_key UNIQUE (bolao_id, whatsapp);