# Guia Completo de Deploy e Publicação no GitHub

Documentação oficial do projeto **Bolão SaaS** (TanStack Start + Lovable Cloud).

---

## Sumário

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Variáveis de ambiente](#3-variáveis-de-ambiente)
4. [Publicação pelo Lovable (recomendado)](#4-publicação-pelo-lovable-recomendado)
5. [Conectar o projeto ao GitHub](#5-conectar-o-projeto-ao-github)
6. [Fluxo de trabalho com GitHub](#6-fluxo-de-trabalho-com-github)
   6.1 [Deploy no Coolify (Docker self-hosted)](#61-deploy-no-coolify-docker-self-hosted)
   6.2 [Deploy em VPS pura (Docker + Nginx)](#62-deploy-em-vps-pura-docker--nginx)
7. [Domínio personalizado](#7-domínio-personalizado)
8. [Deploy fora do Lovable (self-hosting)](#8-deploy-fora-do-lovable-self-hosting)
9. [Banco de dados e migrações](#9-banco-de-dados-e-migrações)
10. [Super Admin](#10-super-admin)
11. [Checklist de produção](#11-checklist-de-produção)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Visão geral da arquitetura

| Camada           | Stack                                                       |
| ---------------- | ----------------------------------------------------------- |
| Frontend         | React 19 + TanStack Start v1 + Vite 7 + Tailwind v4         |
| Server functions | `createServerFn` (`@tanstack/react-start`) — runtime Worker |
| Backend / DB     | Lovable Cloud (Supabase + RLS)                              |
| Realtime         | Supabase Realtime (`useRealtimeMatches`)                    |
| IA               | Lovable AI Gateway (sem chave de API do usuário)            |
| Integrações ext. | API-Football (`FOOTBALL_API_KEY`)                           |

Pastas relevantes:

```text
src/routes/                    rotas (file-based)
  _authenticated/              área logada (gate gerenciado)
  api/public/                  endpoints públicos (webhooks/cron)
src/lib/*.functions.ts         server functions (RPC)
src/lib/*.server.ts            helpers exclusivos do servidor
src/integrations/supabase/     clientes Supabase (auto-gerados)
supabase/migrations/           migrações SQL versionadas
```

---

## 2. Pré-requisitos

- Conta no [Lovable](https://lovable.dev) com workspace acessível.
- Conta no [GitHub](https://github.com) (para sincronização bidirecional).
- Plano pago do Lovable se quiser editar código diretamente fora do editor.
- Para self-host: Node 20+, Bun 1.1+, acesso a um runtime serverless edge (Cloudflare Workers, Netlify Edge, Vercel Edge) ou Node compatível com adapters TanStack.

---

## 3. Variáveis de ambiente

### Visíveis no navegador (`import.meta.env`)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Exclusivas do servidor (`process.env`)

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` _(secret — nunca expor no client)_
- `FOOTBALL_API_KEY`
- `LOVABLE_API_KEY` _(gerenciado pelo Lovable)_

> No Lovable Cloud, secrets são gerenciados em **Project Settings → Secrets**. Não use `.env` versionado.

---

## 4. Publicação pelo Lovable (recomendado)

1. Abra o projeto no editor Lovable.
2. Clique em **Publish** (canto superior direito).
3. Na primeira publicação, o projeto recebe uma URL `https://<slug>.lovable.app`.
4. Mudanças de **frontend** exigem clicar em **Update** para entrar em produção.
5. Mudanças de **backend** (server functions, migrações, secrets) entram **automaticamente** assim que aplicadas.

### URLs estáveis

- Produção: `https://project--<project-id>.lovable.app`
- Preview: `https://project--<project-id>-dev.lovable.app`

Use essas URLs em webhooks e cron jobs — elas não mudam com renomeação do projeto.

---

## 5. Conectar o projeto ao GitHub

1. No editor, abra o menu **+** (canto inferior esquerdo do chat) → **GitHub** → **Connect project**.
2. Autorize o app **Lovable** no GitHub.
3. Escolha a conta/organização destino.
4. Clique em **Create Repository** — o Lovable cria o repo e faz o primeiro push.

> Importação de repositórios existentes ainda não é suportada. Para reaproveitar código antigo, crie o projeto no Lovable, conecte ao GitHub e copie os arquivos manualmente.

---

## 6. Fluxo de trabalho com GitHub

A sincronização é **bidirecional e em tempo real**:

```text
Lovable editor  ⇄  GitHub repo  ⇄  IDE local / CI
```

### Desenvolvimento local

```bash
git clone git@github.com:<org>/<repo>.git
cd <repo>
bun install
bun run dev          # Vite em http://localhost:8080
```

### Ciclo recomendado

1. Crie um branch: `git checkout -b feat/minha-feature`.
2. Implemente e commit normalmente.
3. Abra um Pull Request no GitHub.
4. Após merge na branch padrão, o Lovable sincroniza automaticamente.
5. Volte ao editor Lovable e clique em **Publish → Update** para promover o frontend.

### Boas práticas

- **Nunca** edite `src/routeTree.gen.ts` ou `src/integrations/supabase/*` (auto-gerados).
- **Nunca** comite `.env` com chaves reais — use secrets do Lovable.
- Mantenha migrações em `supabase/migrations/` versionadas.
- Use Conventional Commits (`feat:`, `fix:`, `chore:`) para histórico limpo.

---

## 6.1. Deploy no Coolify (Docker self-hosted)

[Coolify](https://coolify.io) é uma alternativa open-source ao Vercel/Heroku que
roda na sua própria VPS. O repositório já inclui um `Dockerfile` e um
`.dockerignore` prontos — Coolify só precisa apontar para o repositório do
GitHub.

### Passo a passo

1. **Conecte o GitHub ao Coolify** (Sources → GitHub App) e selecione o repo
   do projeto.
2. Em **Projects → + New Resource → Application**, escolha o repositório e o
   branch (`main` em geral).
3. Em **Build Pack**, selecione **Dockerfile** (o Coolify detecta o arquivo
   na raiz automaticamente).
4. **Porta exposta**: `3000` (já configurada no `Dockerfile`).
5. **Build Variables** (necessárias no momento do build, pois são bakadas no
   bundle do client):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
6. **Environment Variables** (runtime — usadas pelas server functions):
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` _(marque como secret)_
   - `FOOTBALL_API_KEY` _(secret)_
   - `LOVABLE_API_KEY` _(secret, se usar Lovable AI Gateway)_
7. **Healthcheck** (opcional, recomendado): `GET /` na porta `3000`.
8. Clique em **Deploy**. Em pushes futuros para `main`, o Coolify faz redeploy
   automático via webhook.

### Como o Dockerfile funciona

| Stage     | Imagem           | O que faz                                                                |
| --------- | ---------------- | ------------------------------------------------------------------------ |
| `deps`    | `oven/bun:1.1`   | `bun install` com cache de camada                                        |
| `build`   | `oven/bun:1.1`   | Roda `bun run build` com `NITRO_PRESET=node-server` e VITE\_\* injetadas |
| `runtime` | `node:20-alpine` | Executa `node .output/server/index.mjs` na porta `3000`                  |

> O preset padrão do Nitro neste template é `cloudflare`. O Dockerfile força
> `NITRO_PRESET=node-server` no build para gerar um servidor Node compatível
> com Docker/Coolify/VPS.

### Domínio e SSL no Coolify

1. Em **Application → Domains**, adicione `meubolao.com.br`.
2. Aponte o DNS (`A` ou `CNAME`) para o IP do servidor Coolify.
3. Ative **Generate SSL Certificate** (Let's Encrypt automático).

### Troubleshooting Coolify

| Sintoma                                    | Causa                                   | Ação                                                 |
| ------------------------------------------ | --------------------------------------- | ---------------------------------------------------- |
| `VITE_SUPABASE_URL is undefined` no client | Var. setada como runtime, não build     | Mova para **Build Variables** e refaça o deploy      |
| `Cannot find module '.output/server/...'`  | Preset Nitro errado                     | Confirme `NITRO_PRESET=node-server` no Dockerfile    |
| `EADDRINUSE` / app não responde            | Outra app na porta 3000                 | Mude `PORT` env + porta exposta no Coolify           |
| 502 após deploy                            | Healthcheck falhando antes da app subir | Aumente o grace period em **Advanced → Healthcheck** |

---

## 6.2. Deploy em VPS pura (Docker + Nginx)

Cenário sem Coolify: uma VPS Ubuntu 22.04+ com Docker e Nginx reverso, publicando em **https://bolao.ai.slz.br**.

### Pré-requisitos na VPS

```bash
# Docker + Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Nginx + Certbot (SSL)
sudo apt install -y nginx certbot python3-certbot-nginx
```

Aponte no DNS de `slz.br`:

| Tipo | Host        | Valor        |
| ---- | ----------- | ------------ |
| `A`  | `bolao.ai`  | IP da VPS    |

### Estrutura na VPS

```bash
mkdir -p /opt/bolao && cd /opt/bolao
git clone git@github.com:<org>/<repo>.git app
cd app
```

### `.env` (raiz da app, permissão 600)

```bash
# Build vars (bakadas no bundle client)
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...

# Runtime vars (server functions)
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # SECRET
FOOTBALL_API_KEY=...            # SECRET
LOVABLE_API_KEY=...             # SECRET (opcional)
CRON_SECRET=...                 # SECRET (cron pg_cron)
```

```bash
chmod 600 .env
```

### `docker-compose.yml`

```yaml
services:
  web:
    build:
      context: .
      args:
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
        VITE_SUPABASE_PUBLISHABLE_KEY: ${VITE_SUPABASE_PUBLISHABLE_KEY}
        VITE_SUPABASE_PROJECT_ID: ${VITE_SUPABASE_PROJECT_ID}
    env_file: .env
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
```

Suba o container:

```bash
docker compose up -d --build
docker compose logs -f web
```

### Nginx reverso — `/etc/nginx/sites-available/bolao.ai.slz.br`

```nginx
server {
    listen 80;
    server_name bolao.ai.slz.br;

    client_max_body_size 20M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/bolao.ai.slz.br /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d bolao.ai.slz.br --redirect --agree-tos -m admin@slz.br --non-interactive
```

Certbot cuida da renovação automática via systemd timer.

### Redeploy contínuo

Faça um pull-and-rebuild ao receber push no `main`:

```bash
# /opt/bolao/deploy.sh
#!/usr/bin/env bash
set -euo pipefail
cd /opt/bolao/app
git pull --ff-only
docker compose up -d --build
docker image prune -f
```

Rode manualmente via SSH, ou plugue um webhook GitHub Actions → SSH.

### Hardening mínimo

- `ufw allow 22,80,443/tcp && ufw enable`.
- Fail2ban no SSH.
- Backup diário: `pg_dump` do banco Supabase para bucket externo (S3/Backblaze).
- `docker compose logs --tail=200 web` no monitoramento.

### Troubleshooting VPS

| Sintoma                                | Causa                     | Ação                                                     |
| -------------------------------------- | ------------------------- | -------------------------------------------------------- |
| 502 no navegador                       | Container caiu ou porta X | `docker compose ps` + `logs web`                         |
| `VITE_*` indefinido no client          | Var faltou como build-arg | Confirme `args:` no `docker-compose.yml`                 |
| SSL falhou no Certbot                  | DNS ainda não propagou    | Espere e rode `certbot --nginx -d ...` de novo           |
| Cron `sync-football` 401               | `CRON_SECRET` divergente  | Ajuste no `.env` e no pg_cron via migração               |

---


## 7. Domínio personalizado

### 7.1 Produção oficial — `bolao.ai.slz.br`

Domínio oficial de produção: **https://bolao.ai.slz.br**

Passo a passo (registrador do domínio `slz.br`):

1. No editor Lovable, abra **Project Settings → Domains → Connect Domain** e insira `bolao.ai.slz.br`.
2. Lovable exibirá dois registros. Como é um subdomínio de terceiro nível, use o **host** `bolao.ai` na zona DNS de `slz.br`:

   | Tipo  | Host (name)      | Valor                       | TTL  |
   | ----- | ---------------- | --------------------------- | ---- |
   | `A`   | `bolao.ai`       | `185.158.133.1`             | 3600 |
   | `TXT` | `_lovable.bolao.ai` | `lovable_verify=...` (Lovable) | 3600 |

   > Se o registrador exigir FQDN, use `bolao.ai.slz.br` e `_lovable.bolao.ai.slz.br`.
   > **Não** crie registro `www` — este é um subdomínio, não um domínio raiz.

3. Se `slz.br` estiver atrás de **Cloudflare** (ou proxy semelhante), marque
   **Advanced → "Domain uses Cloudflare or a similar proxy"** antes de salvar
   no Lovable — a verificação passa a ser via `CNAME` em vez de `A`.
4. Aguarde propagação DNS (5min–72h). Confira com
   `dig bolao.ai.slz.br +short` (deve retornar `185.158.133.1`).
5. O SSL (Let's Encrypt) é provisionado automaticamente. O status na tela de
   Domains passa por `Verifying → Setting up → Active`.
6. Marque `bolao.ai.slz.br` como **Primary** para que a URL `*.lovable.app`
   redirecione para o domínio final.
7. Após o status `Active`, publique novamente (**Publish → Update**) para
   propagar a build atual para produção.

### 7.2 Outros domínios

Para conectar qualquer outro domínio (raiz ou subdomínio), repita o fluxo
acima ajustando os registros conforme instrução do painel do Lovable.



---

## 8. Deploy fora do Lovable (self-hosting)

O código é open-source standard. Para hospedar em outra plataforma:

```bash
bun install
bun run build        # gera .output/ (TanStack Start)
bun run start        # ou deploy do .output em Workers/Node
```

Plataformas validadas:

- **Cloudflare Workers** (alvo padrão do template — `nodejs_compat`).
- **Coolify / Docker** (use o `Dockerfile` na raiz — ver seção [6.1](#61-deploy-no-coolify-docker-self-hosted)).
- **Netlify** / **Vercel** (adapters TanStack).
- **Node 20+** standalone (`NITRO_PRESET=node-server bun run build && node .output/server/index.mjs`).

Configure todas as variáveis da seção [3](#3-variáveis-de-ambiente) no provedor. Para detalhes, consulte: <https://docs.lovable.dev/tips-tricks/self-hosting>.

---

## 9. Banco de dados e migrações

- Toda alteração de schema é uma migração SQL em `supabase/migrations/`.
- No Lovable Cloud, migrações são aplicadas via ferramenta de migração (revisão obrigatória do usuário).
- **Toda tabela em `public` exige `GRANT`** para `authenticated` e `service_role`, mais RLS habilitado com policies.
- Export de dados: **Cloud → Database → Tables → Export CSV**.

---

---

## 10. Super Admin

O papel `super_admin` (definido em `public.app_role`) tem acesso total ao painel de gestão, bypass de RLS via `has_role()` e recebe as notificações administrativas do sistema.

### Conta oficial

| Campo    | Valor                                         |
| -------- | --------------------------------------------- |
| E-mail   | `andreljp@gmail.com`                          |
| WhatsApp | `+55 98 8603-0534`                            |
| Role     | `super_admin` (concedido via trigger de auth) |

O trigger `assign_default_roles_on_confirm` (em `supabase/migrations/`) atribui `super_admin` automaticamente após a confirmação de e-mail para `andreljp@gmail.com`. Qualquer novo organizador cadastrado gera notificação WhatsApp para `+55 98 8603-0534` (secret `SUPER_ADMIN_WHATSAPP_LOGIN_PASSWORD` + webhook em `src/routes/auth.tsx`).

### Trocar o super admin

1. Ajuste o e-mail alvo no trigger `assign_default_roles_on_confirm` via nova migração.
2. Atualize o número em `src/routes/auth.tsx` (variável `SUPER_ADMIN_WHATSAPP`) e em qualquer template WhatsApp que use o número diretamente.
3. Rode a migração e faça redeploy.

> Nunca armazene o número do super admin em código client-side sem também aplicá-lo em uma env var (`SUPER_ADMIN_WHATSAPP`) para permitir rotação sem redeploy do frontend.

---

## 11. Checklist de produção

- [ ] Título, meta description e OG tags configurados em `src/routes/__root.tsx` e rotas-chave.
- [ ] Favicon e ícones presentes.
- [ ] RLS habilitado em todas as tabelas de `public`.
- [ ] `GRANT`s explícitos para `authenticated` / `service_role`.
- [ ] Secrets configurados (`FOOTBALL_API_KEY`, `CRON_SECRET`, `SUPER_ADMIN_WHATSAPP_LOGIN_PASSWORD`, etc.).
- [ ] Provider Google OAuth configurado se houver login social.
- [ ] Scan de segurança executado (**Project Settings → Security**).
- [ ] Domínio de produção `bolao.ai.slz.br` conectado, marcado como Primary e SSL ativo.
- [ ] `robots.txt` e `sitemap.xml` apontando para `https://bolao.ai.slz.br`.
- [ ] Super admin (`andreljp@gmail.com` / `+55 98 8603-0534`) com role atribuído e recebendo notificações.
- [ ] Backup/export de dados antes de migrações destrutivas.

---

## 12. Troubleshooting

| Sintoma                                      | Causa provável                                       | Ação                                                                               |
| -------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 404 em refresh de rota                       | Rota não declarada                                   | Verifique `src/routes/<arquivo>.tsx` e `createFileRoute(...)`.                     |
| `Unauthorized` em server fn protegida        | Bearer não anexado                                   | Confirme `attachSupabaseAuth` em `src/start.ts → functionMiddleware`.              |
| `permission denied for table X`              | Falta `GRANT`                                        | Adicione `GRANT` na migração e reaplique.                                          |
| `build:dev exited with code 1: Unauthorized` | Loader público chamando fn com `requireSupabaseAuth` | Mova a chamada para componente (`useServerFn`) ou para rota sob `_authenticated/`. |
| `[unenv] X is not implemented`               | Pacote Node-only no Worker                           | Troque por lib edge-compatível.                                                    |
| OAuth Google falha em preview                | Não usou `lovable.auth.signInWithOAuth`              | Use o broker do Lovable.                                                           |
| GitHub não sincroniza                        | App Lovable desautorizado                            | Reconecte em **+ → GitHub → Connect project**.                                     |

---

**Documentação oficial:** <https://docs.lovable.dev>
