
ALTER TYPE public.match_phase ADD VALUE IF NOT EXISTS 'round_of_32' BEFORE 'round_of_16';
INSERT INTO public.groups (name) VALUES ('I'),('J'),('K'),('L') ON CONFLICT DO NOTHING;
