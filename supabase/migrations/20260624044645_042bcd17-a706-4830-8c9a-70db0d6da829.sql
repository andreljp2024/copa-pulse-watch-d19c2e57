
CREATE SEQUENCE IF NOT EXISTS public.palpites_codigo_seq;
ALTER TABLE public.palpites
  ADD COLUMN IF NOT EXISTS codigo integer NOT NULL DEFAULT nextval('public.palpites_codigo_seq');
ALTER SEQUENCE public.palpites_codigo_seq OWNED BY public.palpites.codigo;
CREATE UNIQUE INDEX IF NOT EXISTS palpites_codigo_key ON public.palpites(codigo);
