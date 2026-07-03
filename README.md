# Bolão SaaS — Rumo ao Hexa

Plataforma multi-tenant para organização de bolões da Copa do Mundo com apuração automática de ganhadores, integração com API-Football e pagamentos via Pix + WhatsApp.

> Comunicação, código e documentação em pt-BR. Fuso horário padrão: **America/Sao_Paulo (UTC-3)**.

---

## 1. Stack

| Camada          | Tecnologia                                                       |
| --------------- | ---------------------------------------------------------------- |
| Frontend        | React 19 · TanStack Start v1 · Vite 7 · Tailwind v4 · shadcn/ui  |
| Server Runtime  | `createServerFn` (`@tanstack/react-start`) em Cloudflare Workers |
| Backend / DB    | Lovable Cloud (Postgres + RLS + Realtime)                        |
| IA              | Lovable AI Gateway                                                |
| APIs externas   | worldcup26.ir (primária) → football-data.org (fallback)          |
| Mensageria      | WhatsApp via `wa.me` links + Evolution API (opcional)             |

---

## 2. Estrutura do projeto

```text
src/
├── routes/
│   ├── __root.tsx                Layout raiz (head, providers, auth listener)
│   ├── index.tsx                 Landing pública
│   ├── auth.tsx                  Login/cadastro
│   ├── criar-bolao.tsx           Landing de aquisição (planos)
│   ├── bolao.$slug.tsx           Página pública do bolão
│   ├── meus-palpites.$slug.tsx   Consulta pública por WhatsApp
│   ├── _authenticated/           Área logada (gate ssr:false gerenciado)
│   │   ├── app.tsx               Dashboard
│   │   ├── onboarding.tsx        Wizard multi-step (CPF + Pix)
│   │   ├── app.palpites.tsx      Gestão de palpites
│   │   ├── app.ganhadores.tsx    Ganhadores e prêmios
│   │   ├── app.torcedores.tsx    Base de torcedores
│   │   └── app.organizadores.tsx Super Admin
│   └── api/public/               Endpoints públicos (webhooks/cron)
│       └── hooks/sync-football.ts
├── lib/
│   ├── *.functions.ts            Server functions (RPC)
│   ├── *.server.ts               Helpers exclusivos do servidor
│   ├── sync-with-fallback.server.ts  Estratégia de fonte única + fallback
│   ├── timezone.ts               Helpers UTC-3 (`formatBR`)
│   ├── masks.ts                  Máscaras CPF, WhatsApp, Pix
│   └── saas.ts                   Templates de mensagens WhatsApp
├── integrations/supabase/        Clientes auto-gerados (não editar)
└── styles.css                    Tokens semânticos (tema Hexa)

supabase/migrations/              SQL versionado
```

---

## 3. Módulos

### 3.1 Palpites (`app.palpites.tsx`)
- Bandeiras das seleções, data/hora do jogo e do palpite em UTC-3.
- Máscaras de WhatsApp, reativação de palpites cancelados, exportação CSV com BOM.
- Coluna "Palpite" (antigo protocolo) alinhada ao placar apurado.

### 3.2 Ganhadores (`app.ganhadores.tsx`)
- Apuração **automática** via triggers no banco (`tg_apurar_ganhadores` em `matches` e `tg_apurar_ganhador_palpite` em `palpites`).
- Função `apurar_ganhadores_para_match(uuid)` idempotente.
- Exportação CSV em BRL e disparo de mensagens de premiação via WhatsApp.

### 3.3 Dashboard (`app.tsx`)
- Contagens exatas para grandes volumes, cálculos financeiros corrigidos.
- Gráficos Sparkline por dia (UTC-3) com skeletons de carregamento.

### 3.4 Torcedores (`app.torcedores.tsx`)
- Data de cadastro = `min(created_at)` dos palpites do torcedor.
- Colunas simplificadas.

### 3.5 Onboarding (`onboarding.tsx`)
- Passo 1: CPF + Chave Pix (validação imediata, nome do estabelecimento derivado).
- Passo 2: detalhes complementares e WhatsApp.
- Passo 3: bolão + slug.
- Retomada inteligente, indicador de progresso, botão "Voltar".

### 3.6 Organizadores — Super Admin (`app.organizadores.tsx`)
- Gestão de papéis, suspensão de acesso, recuperação de senha, divulgação WhatsApp.
- Botão "Liberar" migra o tenant para plano ilimitado.

### 3.7 Planos
- **Grátis**: 50 palpites (enforcement via trigger `enforce_palpite_limit`).
- **Consulte o Dev**: ilimitado, ativado manualmente pelo Super Admin.

### 3.8 Sincronização de jogos
- Fonte primária **worldcup26.ir**; fallback automático para **football-data.org**.
- Deduplicação garantida por `sync-with-fallback.server.ts` — sem duplicidade em `matches`.
- Cron público em `/api/public/hooks/sync-football` protegido por `CRON_SECRET`.

---

## 4. Módulos avançados (2026)

### 4.1 Notificações
- Fila persistente em `notification_queue` alimentada por triggers (`tg_enqueue_ganhador_notif`, `tg_enqueue_ganhador_push`).
- Dispatcher WhatsApp: `/api/public/hooks/dispatch-notifications` (backoff exponencial).
- Push nativo (Web Push RFC 8291 + VAPID): `/api/public/hooks/dispatch-push` com criptografia AES-128-GCM via Web Crypto.
- Cron `pg_cron` dispara ambos a cada minuto.

### 4.2 PWA offline-first
- `vite-plugin-pwa` com `NetworkFirst` (HTML), `CacheFirst` (bandeiras) e `StaleWhileRevalidate` (assets).
- Registro do Service Worker via `src/lib/register-sw.ts` — só em produção, nunca em iframe.

### 4.3 Segurança e anti-fraude
- `rate_limits` + `check_rate_limit()` — 10 palpites/min por WhatsApp em `submit_palpite`.
- View `fraud_signals` (≥20 palpites em 10min ou >50 pendentes).
- Painel `/app/seguranca`: bloqueio/desbloqueio de torcedor via `set_torcedor_bloqueado()`.
- Flag `bloqueado` em `torcedores` verificada em `submit_palpite`.

### 4.4 Performance
- MV `mv_ranking_torcedores` — `get_bolao_ranking` lê em O(log n). Refresh 5min via `pg_cron`.
- MV `mv_dashboard_organizador` — `get_dashboard_organizador` consolida 6 KPIs em uma leitura. Refresh 5min.
- MVs **não expostas** via Data API — acesso somente por RPC `SECURITY DEFINER`.

### 4.5 Auditoria e Backup (`/app/auditoria`)
- Tabela `audit_log` + trigger genérico `tg_audit_generic` em: `boloes`, `tenants`, `assinaturas`, `user_roles`, `torcedores.bloqueado`, `tenant_pix_config`, `tenant_whatsapp_config`.
- `list_audit_log(limit, offset)` — leitura paginada com RLS por tenant + super admin.
- `log_audit_event()` — registro custom (não-DML).
- `export_bolao(uuid)` — backup JSON completo (bolão + jogos + torcedores + palpites + ganhadores). Exportação é auditada.

---

## 5. Segurança

- **RLS habilitada** em todas as tabelas de `public`. Políticas escopadas por `auth.uid()` + `has_role()`.
- **Roles em tabela separada** (`user_roles` + enum `app_role`) — nunca no perfil.
- Função `has_role(_user_id, _role)` `SECURITY DEFINER` para evitar recursão em políticas.
- **RPCs anônimas explícitas** (única superfície pública): `submit_palpite`, `consultar_palpites_por_whatsapp`, `get_bolao_public_payment`, `get_bolao_ranking`, `check_rate_limit`. Todas as demais RPCs `SECURITY DEFINER` tiveram `EXECUTE` revogado de `anon`.
- Materialized views revogadas de `anon`/`authenticated` — acesso apenas via RPC autorizada.
- `SUPABASE_SERVICE_ROLE_KEY` lido **apenas** dentro de `.server.ts` via `await import(...)` — nunca no bundle do cliente.
- Auth server-side com `requireSupabaseAuth` (middleware) + bearer attacher no `src/start.ts`. Zero verificação de role no client.
- Fuso horário centralizado em `src/lib/timezone.ts` — usar sempre `formatBR*`.



---

## 5. Variáveis de ambiente

**Servidor** (`process.env`):
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `FOOTBALL_API_KEY` — football-data.org (fallback)
- `CRON_SECRET` — protege endpoint de sync
- `LOVABLE_API_KEY` — AI Gateway
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — Web Push

**Cliente** (`import.meta.env`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## 7. Auditoria de segurança (jul/2026)

Executada via `supabase--linter` + revisão manual de `pg_proc`. Estado atual:

| Item | Status |
| ---- | ------ |
| RLS em todas as tabelas `public` | ✅ |
| `EXECUTE` de `anon` apenas em RPCs públicas explícitas | ✅ |
| Materialized views bloqueadas na Data API | ✅ |
| Service role apenas em `.server.ts` (lazy import) | ✅ |
| Auth 100% server-side (`requireSupabaseAuth`) | ✅ |
| Rate limiting em `submit_palpite` (10/min por WhatsApp) | ✅ |
| Auditoria com `before`/`after` JSONB em ações sensíveis | ✅ |
| Extensões em `public` (warn cosmético `pg_cron`/`pg_net`) | ⚠️ aceitável |
| Triggers `SECURITY DEFINER` sinalizados pelo linter | ⚠️ falso-positivo (só executam via trigger) |

---

## 8. Convenções

- **Datas**: sempre `formatBR*` de `src/lib/timezone.ts`.
- **Server functions**: `.functions.ts` importáveis pelo cliente; `.server.ts` somente pelo servidor.
- **Migrations**: todo `CREATE TABLE` em `public` deve trazer `GRANT` + `ENABLE RLS` + `CREATE POLICY` na mesma migração.
- **Estilo**: fundos amarelos/dourados usam `text-black` (contraste). Tokens semânticos em `styles.css`.
- **Mensagens WhatsApp**: templates em `src/lib/saas.ts` com variáveis dinâmicas (`{{bandeira_a}}`, `{{valor}}`, etc.).

---

## 9. Deploy

- **Produção**: <https://bolao.ai.slz.br>
- **Preview / Lovable**: <https://copa-pulse-watch.lovable.app>

Fluxo resumido:

1. Commits em `main` sincronizam automaticamente via integração Lovable ↔ GitHub.
2. Publicar em produção: **Publish → Update** no editor Lovable.
3. Domínio customizado `bolao.ai.slz.br` conectado em **Project Settings → Domains** (registro `A bolao.ai → 185.158.133.1` + `TXT _lovable.bolao.ai`).

Guia completo: [`DEPLOY.md`](./DEPLOY.md) (Lovable, GitHub, Coolify, DNS, self-hosting).


---

## 10. Super Admin

- Email exclusivo: **andreljp@gmail.com** (atribuição via `assign_default_roles_on_confirm`).
- Demais usuários confirmados recebem `tenant_admin` automaticamente.
- Ações privilegiadas: liberar plano ilimitado, suspender organizadores, bloquear torcedores, ler auditoria global.

