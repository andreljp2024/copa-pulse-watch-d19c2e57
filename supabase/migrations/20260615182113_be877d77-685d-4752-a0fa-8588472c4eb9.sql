
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.match_status AS ENUM ('scheduled', 'live', 'finished', 'postponed', 'cancelled');
CREATE TYPE public.match_phase AS ENUM ('group', 'round_of_16', 'quarter', 'semi', 'third_place', 'final');
CREATE TYPE public.event_type AS ENUM ('goal', 'own_goal', 'penalty', 'yellow_card', 'red_card', 'substitution');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- profile auto-create
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
          NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- groups
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.groups TO anon, authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups_public_read" ON public.groups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "groups_admin_write" ON public.groups FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- stadiums
CREATE TABLE public.stadiums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  capacity INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stadiums TO anon, authenticated;
GRANT ALL ON public.stadiums TO service_role;
ALTER TABLE public.stadiums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stadiums_public_read" ON public.stadiums FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "stadiums_admin_write" ON public.stadiums FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- referees
CREATE TABLE public.referees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referees TO anon, authenticated;
GRANT ALL ON public.referees TO service_role;
ALTER TABLE public.referees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referees_public_read" ON public.referees FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "referees_admin_write" ON public.referees FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  flag_url TEXT,
  confederation TEXT,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  coach_name TEXT,
  fifa_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_public_read" ON public.teams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "teams_admin_write" ON public.teams FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- players
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  shirt_number INTEGER,
  position TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_public_read" ON public.players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "players_admin_write" ON public.players FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  away_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  phase public.match_phase NOT NULL DEFAULT 'group',
  stadium_id UUID REFERENCES public.stadiums(id) ON DELETE SET NULL,
  referee_id UUID REFERENCES public.referees(id) ON DELETE SET NULL,
  kickoff_at TIMESTAMPTZ NOT NULL,
  status public.match_status NOT NULL DEFAULT 'scheduled',
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  attendance INTEGER,
  man_of_the_match UUID REFERENCES public.players(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_public_read" ON public.matches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "matches_admin_write" ON public.matches FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_matches_updated BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_matches_kickoff ON public.matches(kickoff_at);
CREATE INDEX idx_matches_status ON public.matches(status);

-- match_events
CREATE TABLE public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  related_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  minute INTEGER NOT NULL DEFAULT 0,
  type public.event_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.match_events TO anon, authenticated;
GRANT ALL ON public.match_events TO service_role;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_events_public_read" ON public.match_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "match_events_admin_write" ON public.match_events FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- match_statistics
CREATE TABLE public.match_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  possession INTEGER, shots INTEGER, shots_on_target INTEGER,
  corners INTEGER, fouls INTEGER, offsides INTEGER,
  passes INTEGER, passes_accurate INTEGER, saves INTEGER,
  UNIQUE(match_id, team_id)
);
GRANT SELECT ON public.match_statistics TO anon, authenticated;
GRANT ALL ON public.match_statistics TO service_role;
ALTER TABLE public.match_statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_stats_public_read" ON public.match_statistics FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "match_stats_admin_write" ON public.match_statistics FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- match_lineups
CREATE TABLE public.match_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  is_starter BOOLEAN NOT NULL DEFAULT true,
  position TEXT,
  shirt_number INTEGER,
  UNIQUE(match_id, player_id)
);
GRANT SELECT ON public.match_lineups TO anon, authenticated;
GRANT ALL ON public.match_lineups TO service_role;
ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lineups_public_read" ON public.match_lineups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lineups_admin_write" ON public.match_lineups FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- api_sync_logs (admin only)
CREATE TABLE public.api_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.api_sync_logs TO authenticated;
GRANT ALL ON public.api_sync_logs TO service_role;
ALTER TABLE public.api_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_logs_admin_read" ON public.api_sync_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sync_logs_admin_write" ON public.api_sync_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- standings view (group stage)
CREATE OR REPLACE VIEW public.v_standings AS
WITH per_team AS (
  SELECT
    t.id AS team_id, t.group_id, t.name, t.code, t.flag_url,
    m.id AS match_id,
    CASE
      WHEN m.status = 'finished' AND m.home_team_id = t.id THEN m.home_score
      WHEN m.status = 'finished' AND m.away_team_id = t.id THEN m.away_score
    END AS gf,
    CASE
      WHEN m.status = 'finished' AND m.home_team_id = t.id THEN m.away_score
      WHEN m.status = 'finished' AND m.away_team_id = t.id THEN m.home_score
    END AS ga
  FROM public.teams t
  LEFT JOIN public.matches m
    ON m.phase = 'group' AND m.status = 'finished'
   AND (m.home_team_id = t.id OR m.away_team_id = t.id)
)
SELECT
  team_id, group_id, name, code, flag_url,
  COUNT(match_id) FILTER (WHERE match_id IS NOT NULL)::int AS played,
  COALESCE(SUM(CASE WHEN gf > ga THEN 1 ELSE 0 END),0)::int AS wins,
  COALESCE(SUM(CASE WHEN gf = ga AND match_id IS NOT NULL THEN 1 ELSE 0 END),0)::int AS draws,
  COALESCE(SUM(CASE WHEN gf < ga THEN 1 ELSE 0 END),0)::int AS losses,
  COALESCE(SUM(gf),0)::int AS goals_for,
  COALESCE(SUM(ga),0)::int AS goals_against,
  COALESCE(SUM(gf),0)::int - COALESCE(SUM(ga),0)::int AS goal_diff,
  COALESCE(SUM(CASE WHEN gf > ga THEN 3 WHEN gf = ga AND match_id IS NOT NULL THEN 1 ELSE 0 END),0)::int AS points
FROM per_team
GROUP BY team_id, group_id, name, code, flag_url;
GRANT SELECT ON public.v_standings TO anon, authenticated;

-- Top scorers view
CREATE OR REPLACE VIEW public.v_top_scorers AS
SELECT p.id AS player_id, p.name, p.team_id, t.name AS team_name, t.flag_url, t.code AS team_code,
       COUNT(*)::int AS goals
FROM public.match_events e
JOIN public.players p ON p.id = e.player_id
JOIN public.teams t ON t.id = p.team_id
WHERE e.type IN ('goal','penalty')
GROUP BY p.id, p.name, p.team_id, t.name, t.flag_url, t.code
ORDER BY goals DESC;
GRANT SELECT ON public.v_top_scorers TO anon, authenticated;

-- SEED DATA
INSERT INTO public.groups (name) VALUES ('A'),('B'),('C'),('D'),('E'),('F'),('G'),('H');

INSERT INTO public.stadiums (name, city, country, capacity) VALUES
('Estádio Maracanã','Rio de Janeiro','Brasil',78838),
('Estádio Monumental','Buenos Aires','Argentina',83214),
('Wembley Stadium','London','England',90000),
('Stade de France','Paris','France',80698),
('Allianz Arena','Munich','Germany',75024),
('Santiago Bernabéu','Madrid','Spain',81044);

INSERT INTO public.teams (name, code, flag_url, confederation, group_id, coach_name, fifa_rank) VALUES
('Brasil','BRA','https://flagcdn.com/w160/br.png','CONMEBOL',(SELECT id FROM public.groups WHERE name='A'),'Dorival Júnior',5),
('Sérvia','SRB','https://flagcdn.com/w160/rs.png','UEFA',(SELECT id FROM public.groups WHERE name='A'),'Dragan Stojković',33),
('Suíça','SUI','https://flagcdn.com/w160/ch.png','UEFA',(SELECT id FROM public.groups WHERE name='A'),'Murat Yakin',19),
('Camarões','CMR','https://flagcdn.com/w160/cm.png','CAF',(SELECT id FROM public.groups WHERE name='A'),'Marc Brys',41),
('Argentina','ARG','https://flagcdn.com/w160/ar.png','CONMEBOL',(SELECT id FROM public.groups WHERE name='B'),'Lionel Scaloni',1),
('México','MEX','https://flagcdn.com/w160/mx.png','CONCACAF',(SELECT id FROM public.groups WHERE name='B'),'Javier Aguirre',15),
('Polônia','POL','https://flagcdn.com/w160/pl.png','UEFA',(SELECT id FROM public.groups WHERE name='B'),'Michał Probierz',28),
('Arábia Saudita','KSA','https://flagcdn.com/w160/sa.png','AFC',(SELECT id FROM public.groups WHERE name='B'),'Roberto Mancini',56),
('França','FRA','https://flagcdn.com/w160/fr.png','UEFA',(SELECT id FROM public.groups WHERE name='C'),'Didier Deschamps',2),
('Dinamarca','DEN','https://flagcdn.com/w160/dk.png','UEFA',(SELECT id FROM public.groups WHERE name='C'),'Brian Riemer',21),
('Tunísia','TUN','https://flagcdn.com/w160/tn.png','CAF',(SELECT id FROM public.groups WHERE name='C'),'Faouzi Benzarti',49),
('Austrália','AUS','https://flagcdn.com/w160/au.png','AFC',(SELECT id FROM public.groups WHERE name='C'),'Tony Popovic',25),
('Inglaterra','ENG','https://flagcdn.com/w160/gb-eng.png','UEFA',(SELECT id FROM public.groups WHERE name='D'),'Thomas Tuchel',4),
('EUA','USA','https://flagcdn.com/w160/us.png','CONCACAF',(SELECT id FROM public.groups WHERE name='D'),'Mauricio Pochettino',16),
('País de Gales','WAL','https://flagcdn.com/w160/gb-wls.png','UEFA',(SELECT id FROM public.groups WHERE name='D'),'Craig Bellamy',31),
('Irã','IRN','https://flagcdn.com/w160/ir.png','AFC',(SELECT id FROM public.groups WHERE name='D'),'Amir Ghalenoei',20);

-- Players (small sample for a few teams)
INSERT INTO public.players (team_id, name, shirt_number, position) VALUES
((SELECT id FROM public.teams WHERE code='BRA'),'Alisson',1,'GK'),
((SELECT id FROM public.teams WHERE code='BRA'),'Marquinhos',4,'DF'),
((SELECT id FROM public.teams WHERE code='BRA'),'Vinicius Jr.',7,'FW'),
((SELECT id FROM public.teams WHERE code='BRA'),'Rodrygo',10,'FW'),
((SELECT id FROM public.teams WHERE code='BRA'),'Casemiro',5,'MF'),
((SELECT id FROM public.teams WHERE code='ARG'),'Emiliano Martínez',23,'GK'),
((SELECT id FROM public.teams WHERE code='ARG'),'Lionel Messi',10,'FW'),
((SELECT id FROM public.teams WHERE code='ARG'),'Julián Álvarez',9,'FW'),
((SELECT id FROM public.teams WHERE code='ARG'),'Rodrigo De Paul',7,'MF'),
((SELECT id FROM public.teams WHERE code='FRA'),'Mike Maignan',16,'GK'),
((SELECT id FROM public.teams WHERE code='FRA'),'Kylian Mbappé',10,'FW'),
((SELECT id FROM public.teams WHERE code='FRA'),'Antoine Griezmann',7,'MF'),
((SELECT id FROM public.teams WHERE code='ENG'),'Jordan Pickford',1,'GK'),
((SELECT id FROM public.teams WHERE code='ENG'),'Harry Kane',9,'FW'),
((SELECT id FROM public.teams WHERE code='ENG'),'Jude Bellingham',10,'MF');

-- Sample matches
INSERT INTO public.matches (home_team_id, away_team_id, group_id, phase, stadium_id, kickoff_at, status, home_score, away_score) VALUES
((SELECT id FROM public.teams WHERE code='BRA'),(SELECT id FROM public.teams WHERE code='SRB'),(SELECT id FROM public.groups WHERE name='A'),'group',(SELECT id FROM public.stadiums WHERE name='Estádio Maracanã'),now() - interval '5 days','finished',2,0),
((SELECT id FROM public.teams WHERE code='SUI'),(SELECT id FROM public.teams WHERE code='CMR'),(SELECT id FROM public.groups WHERE name='A'),'group',(SELECT id FROM public.stadiums WHERE name='Allianz Arena'),now() - interval '5 days' + interval '3 hours','finished',1,0),
((SELECT id FROM public.teams WHERE code='ARG'),(SELECT id FROM public.teams WHERE code='KSA'),(SELECT id FROM public.groups WHERE name='B'),'group',(SELECT id FROM public.stadiums WHERE name='Estádio Monumental'),now() - interval '4 days','finished',2,1),
((SELECT id FROM public.teams WHERE code='MEX'),(SELECT id FROM public.teams WHERE code='POL'),(SELECT id FROM public.groups WHERE name='B'),'group',(SELECT id FROM public.stadiums WHERE name='Santiago Bernabéu'),now() - interval '4 days' + interval '3 hours','finished',1,1),
((SELECT id FROM public.teams WHERE code='FRA'),(SELECT id FROM public.teams WHERE code='AUS'),(SELECT id FROM public.groups WHERE name='C'),'group',(SELECT id FROM public.stadiums WHERE name='Stade de France'),now() - interval '3 days','finished',4,1),
((SELECT id FROM public.teams WHERE code='ENG'),(SELECT id FROM public.teams WHERE code='IRN'),(SELECT id FROM public.groups WHERE name='D'),'group',(SELECT id FROM public.stadiums WHERE name='Wembley Stadium'),now() - interval '2 days','finished',6,2),
-- live
((SELECT id FROM public.teams WHERE code='BRA'),(SELECT id FROM public.teams WHERE code='SUI'),(SELECT id FROM public.groups WHERE name='A'),'group',(SELECT id FROM public.stadiums WHERE name='Estádio Maracanã'),now() - interval '30 minutes','live',1,0),
-- scheduled
((SELECT id FROM public.teams WHERE code='ARG'),(SELECT id FROM public.teams WHERE code='MEX'),(SELECT id FROM public.groups WHERE name='B'),'group',(SELECT id FROM public.stadiums WHERE name='Estádio Monumental'),now() + interval '1 day','scheduled',0,0),
((SELECT id FROM public.teams WHERE code='FRA'),(SELECT id FROM public.teams WHERE code='DEN'),(SELECT id FROM public.groups WHERE name='C'),'group',(SELECT id FROM public.stadiums WHERE name='Stade de France'),now() + interval '2 days','scheduled',0,0),
((SELECT id FROM public.teams WHERE code='ENG'),(SELECT id FROM public.teams WHERE code='USA'),(SELECT id FROM public.groups WHERE name='D'),'group',(SELECT id FROM public.stadiums WHERE name='Wembley Stadium'),now() + interval '3 days','scheduled',0,0),
((SELECT id FROM public.teams WHERE code='TUN'),(SELECT id FROM public.teams WHERE code='AUS'),(SELECT id FROM public.groups WHERE name='C'),'group',(SELECT id FROM public.stadiums WHERE name='Allianz Arena'),now() + interval '4 days','scheduled',0,0);

-- sample events for finished matches
INSERT INTO public.match_events (match_id, team_id, player_id, minute, type, description)
SELECT m.id, (SELECT id FROM public.teams WHERE code='BRA'), (SELECT id FROM public.players WHERE name='Vinicius Jr.'), 23, 'goal','Gol de Vinicius Jr.'
FROM public.matches m WHERE m.home_team_id=(SELECT id FROM public.teams WHERE code='BRA') AND m.away_team_id=(SELECT id FROM public.teams WHERE code='SRB');
INSERT INTO public.match_events (match_id, team_id, player_id, minute, type, description)
SELECT m.id, (SELECT id FROM public.teams WHERE code='BRA'), (SELECT id FROM public.players WHERE name='Rodrygo'), 67, 'goal','Belíssimo gol de Rodrygo'
FROM public.matches m WHERE m.home_team_id=(SELECT id FROM public.teams WHERE code='BRA') AND m.away_team_id=(SELECT id FROM public.teams WHERE code='SRB');
INSERT INTO public.match_events (match_id, team_id, player_id, minute, type, description)
SELECT m.id, (SELECT id FROM public.teams WHERE code='ARG'), (SELECT id FROM public.players WHERE name='Lionel Messi'), 34,'penalty','Gol de pênalti de Messi'
FROM public.matches m WHERE m.home_team_id=(SELECT id FROM public.teams WHERE code='ARG') AND m.away_team_id=(SELECT id FROM public.teams WHERE code='KSA');
INSERT INTO public.match_events (match_id, team_id, player_id, minute, type, description)
SELECT m.id, (SELECT id FROM public.teams WHERE code='ARG'), (SELECT id FROM public.players WHERE name='Julián Álvarez'), 78,'goal','Gol de Julián Álvarez'
FROM public.matches m WHERE m.home_team_id=(SELECT id FROM public.teams WHERE code='ARG') AND m.away_team_id=(SELECT id FROM public.teams WHERE code='KSA');
INSERT INTO public.match_events (match_id, team_id, player_id, minute, type, description)
SELECT m.id, (SELECT id FROM public.teams WHERE code='FRA'), (SELECT id FROM public.players WHERE name='Kylian Mbappé'), 12,'goal','Mbappé abre o placar'
FROM public.matches m WHERE m.home_team_id=(SELECT id FROM public.teams WHERE code='FRA') AND m.away_team_id=(SELECT id FROM public.teams WHERE code='AUS');
INSERT INTO public.match_events (match_id, team_id, player_id, minute, type, description)
SELECT m.id, (SELECT id FROM public.teams WHERE code='FRA'), (SELECT id FROM public.players WHERE name='Kylian Mbappé'), 55,'goal','Segundo de Mbappé'
FROM public.matches m WHERE m.home_team_id=(SELECT id FROM public.teams WHERE code='FRA') AND m.away_team_id=(SELECT id FROM public.teams WHERE code='AUS');
INSERT INTO public.match_events (match_id, team_id, player_id, minute, type, description)
SELECT m.id, (SELECT id FROM public.teams WHERE code='ENG'), (SELECT id FROM public.players WHERE name='Harry Kane'), 18,'goal','Kane balança a rede'
FROM public.matches m WHERE m.home_team_id=(SELECT id FROM public.teams WHERE code='ENG') AND m.away_team_id=(SELECT id FROM public.teams WHERE code='IRN');
INSERT INTO public.match_events (match_id, team_id, player_id, minute, type, description)
SELECT m.id, (SELECT id FROM public.teams WHERE code='ENG'), (SELECT id FROM public.players WHERE name='Jude Bellingham'), 41,'goal','Bellingham amplia'
FROM public.matches m WHERE m.home_team_id=(SELECT id FROM public.teams WHERE code='ENG') AND m.away_team_id=(SELECT id FROM public.teams WHERE code='IRN');
