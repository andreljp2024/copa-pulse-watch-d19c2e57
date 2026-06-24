
-- Drop trigger that referenced the plaintext column
DROP TRIGGER IF EXISTS torcedores_hash_token ON public.torcedores;

-- Remove the plaintext token entirely
ALTER TABLE public.torcedores DROP COLUMN IF EXISTS token_acesso;

-- Replace the trigger function: hashing now happens at write time via RPC/inserts
-- supplying token_acesso_hash directly. Keep a no-op safeguard that strips any
-- accidental future plaintext attempts.
CREATE OR REPLACE FUNCTION public.tg_hash_torcedor_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- token_acesso column no longer exists; this function is retained only
  -- to avoid breaking any external references and is a no-op.
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_hash_torcedor_token() FROM PUBLIC, anon, authenticated;
