# CopaHub — Plano da Primeira Versão

Plataforma web moderna e responsiva para acompanhar a Copa do Mundo, com Supabase (Lovable Cloud) como banco e estrutura preparada para integração futura com API externa de futebol.

## Escopo desta primeira versão

Entregáveis funcionais:
1. **Dashboard** com próximos jogos, ao vivo, últimos resultados, mini-classificação e destaques (artilheiros).
2. **Seleções** — listagem com bandeira, grupo, técnico, ranking FIFA + página de detalhe (elenco, estatísticas).
3. **Grupos** — 8 grupos com tabela de classificação calculada automaticamente a partir dos resultados.
4. **Calendário de Jogos** — lista com filtros (data, grupo, fase, seleção, estádio, status).
5. **Detalhes da Partida** — escalações, placar, eventos (gols/cartões/substituições), estatísticas, árbitro, estádio.
6. **Chaveamento mata-mata** visual (placeholder até resultados de grupos).
7. **Painel Admin** (rota protegida, role `admin`) — CRUD de seleções, jogadores, partidas, estádios, grupos; atualização manual de placar e eventos; logs de sincronização; botão "Sincronizar API" (stub).
8. **Auth** — email/senha + Google; tabela `profiles` + `user_roles` (enum `app_role`).
9. **Estrutura para API externa** — server function `syncFromExternalApi` com interface clara, grava em `api_sync_logs`. Sem credenciais ainda; usuário pluga a API depois.
10. **Tema claro/escuro**, design esportivo elegante, mobile-first.

Fora do escopo (preparado para depois): notificações push, PWA install, notícias, compartilhamento social, integração real com API-Football/SportMonks (estrutura pronta, chave a ser adicionada via secrets).

## Arquitetura técnica

- **Stack**: TanStack Start + Tailwind + shadcn (template). Lovable Cloud (Supabase) para DB/Auth.
- **Server functions** (`src/lib/*.functions.ts`) para leituras públicas (usando `supabaseAdmin` dentro do handler) e mutações admin (com `requireSupabaseAuth` + checagem `has_role('admin')`).
- **Rotas públicas** (SSR): `/`, `/selecoes`, `/selecoes/$id`, `/grupos`, `/calendario`, `/partidas/$id`, `/mata-mata`, `/estatisticas`.
- **Rotas protegidas**: `/_authenticated/admin/*` para painel.
- **Auth**: `/auth` (login/signup), gate em `_authenticated/route.tsx` (gerenciado pela integração).
- **TanStack Query** para fetch/cache.

## Schema do banco (migrations)

Enums: `app_role` (admin, user), `match_status` (scheduled, live, finished, postponed, cancelled), `match_phase` (group, round_of_16, quarter, semi, third_place, final), `event_type` (goal, yellow_card, red_card, substitution, own_goal, penalty).

Tabelas (todas em `public` com GRANTs + RLS):
- `profiles` (id→auth.users, display_name, avatar_url) — auto-criada por trigger.
- `user_roles` (user_id, role) + função `has_role(uuid, app_role)` SECURITY DEFINER.
- `stadiums` (name, city, country, capacity).
- `groups` (name "A"–"H").
- `teams` (name, code, flag_url, confederation, group_id, coach_name, fifa_rank).
- `players` (team_id, name, number, position, photo_url).
- `referees` (name, country).
- `matches` (home_team_id, away_team_id, group_id, phase, stadium_id, referee_id, kickoff_at, status, home_score, away_score, attendance).
- `match_events` (match_id, minute, type, team_id, player_id, related_player_id, description).
- `match_statistics` (match_id, team_id, possession, shots, shots_on_target, corners, fouls, offsides, passes, passes_accurate, saves).
- `match_lineups` (match_id, team_id, player_id, is_starter, position, shirt_number).
- `api_sync_logs` (source, action, status, message, payload jsonb, created_at).

**Classificação dos grupos**: view `v_standings` calculada a partir de `matches` finalizadas (pontos, J, V, E, D, GP, GC, SG), com critérios de desempate (pontos → SG → GP → confronto direto).

**RLS**:
- Leitura pública (`anon` + `authenticated`) em `teams`, `players`, `groups`, `matches`, `match_events`, `match_statistics`, `match_lineups`, `stadiums`, `referees`, `v_standings`.
- Escrita apenas para `has_role(auth.uid(),'admin')`.
- `profiles`: usuário lê/edita o próprio; admin lê todos.
- `user_roles`: somente admin escreve; usuário lê o próprio.
- `api_sync_logs`: somente admin.

## Design

- Paleta inspirada em Copa: verde-campo profundo, dourado de troféu, branco. Tokens em `src/styles.css` (oklch). Gradientes sutis em hero e cards de destaque.
- Tipografia: display forte para placares; sans clean para corpo.
- Componentes: `TeamBadge` (bandeira+nome), `MatchCard`, `LiveBadge` pulsante, `StandingsTable`, `GroupCard`, `BracketTree`, `StatBar`, `EventTimeline`.
- Modo claro/escuro via toggle.

## Passos de implementação

1. Habilitar Lovable Cloud.
2. Migration: enums, tabelas, GRANTs, RLS, trigger de profile, função `has_role`, view `v_standings`.
3. Seed mínimo (8 grupos, ~8 seleções de exemplo, alguns jogos) via migration para a demo não ficar vazia.
4. Design system em `src/styles.css` + componentes base.
5. Server functions: `getDashboard`, `listTeams`, `getTeam`, `listGroupsWithStandings`, `listMatches`, `getMatch`, `listTopScorers`, admin CRUDs, `syncFromExternalApi` (stub que grava log).
6. Rotas públicas + páginas.
7. Auth (`/auth`) + gate `_authenticated`.
8. Painel admin com CRUDs essenciais e botão Sincronizar.
9. QA visual mobile/desktop.

```text
src/
├── routes/
│   ├── __root.tsx, index.tsx, auth.tsx
│   ├── selecoes.tsx, selecoes.$id.tsx
│   ├── grupos.tsx, calendario.tsx
│   ├── partidas.$id.tsx, mata-mata.tsx, estatisticas.tsx
│   └── _authenticated/admin.*.tsx
├── lib/{teams,matches,groups,admin,sync}.functions.ts
└── components/{TeamBadge,MatchCard,StandingsTable,...}
```

## Perguntas antes de começar

Vou perguntar 1–2 coisas chave (login e dados iniciais) depois que você aprovar o plano.