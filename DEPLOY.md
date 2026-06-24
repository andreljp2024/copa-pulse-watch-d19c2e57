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
7. [Domínio personalizado](#7-domínio-personalizado)
8. [Deploy fora do Lovable (self-hosting)](#8-deploy-fora-do-lovable-self-hosting)
9. [Banco de dados e migrações](#9-banco-de-dados-e-migrações)
10. [Checklist de produção](#10-checklist-de-produção)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Visão geral da arquitetura

| Camada            | Stack                                                       |
| ----------------- | ----------------------------------------------------------- |
| Frontend          | React 19 + TanStack Start v1 + Vite 7 + Tailwind v4         |
| Server functions  | `createServerFn` (`@tanstack/react-start`) — runtime Worker |
| Backend / DB      | Lovable Cloud (Supabase + RLS)                              |
| Realtime          | Supabase Realtime (`useRealtimeMatches`)                    |
| IA                | Lovable AI Gateway (sem chave de API do usuário)            |
| Integrações ext.  | API-Football (`FOOTBALL_API_KEY`)                           |

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
- `SUPABASE_SERVICE_ROLE_KEY` *(secret — nunca expor no client)*
- `FOOTBALL_API_KEY`
- `LOVABLE_API_KEY` *(gerenciado pelo Lovable)*

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
- Preview:  `https://project--<project-id>-dev.lovable.app`

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

## 7. Domínio personalizado

1. **Project Settings → Domains → Connect Domain**.
2. Insira o domínio (ex.: `meubolao.com.br`).
3. Configure no seu registrador:
   - `A`  @   → `185.158.133.1`
   - `A`  www → `185.158.133.1`
   - `TXT` `_lovable` → valor fornecido pelo Lovable
4. Aguarde propagação DNS (até 72h). SSL é provisionado automaticamente.

> Se usar Cloudflare em modo proxy, marque **Advanced → "Domain uses Cloudflare or a similar proxy"** para usar verificação por CNAME.

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
- **Netlify** / **Vercel** (adapters TanStack).
- **Node 20+** standalone.

Configure todas as variáveis da seção [3](#3-variáveis-de-ambiente) no provedor. Para detalhes, consulte: <https://docs.lovable.dev/tips-tricks/self-hosting>.

---

## 9. Banco de dados e migrações

- Toda alteração de schema é uma migração SQL em `supabase/migrations/`.
- No Lovable Cloud, migrações são aplicadas via ferramenta de migração (revisão obrigatória do usuário).
- **Toda tabela em `public` exige `GRANT`** para `authenticated` e `service_role`, mais RLS habilitado com policies.
- Export de dados: **Cloud → Database → Tables → Export CSV**.

---

## 10. Checklist de produção

- [ ] Título, meta description e OG tags configurados em `src/routes/__root.tsx` e rotas-chave.
- [ ] Favicon e ícones presentes.
- [ ] RLS habilitado em todas as tabelas de `public`.
- [ ] `GRANT`s explícitos para `authenticated` / `service_role`.
- [ ] Secrets configurados (`FOOTBALL_API_KEY`, etc.).
- [ ] Provider Google OAuth configurado se houver login social.
- [ ] Scan de segurança executado (**Project Settings → Security**).
- [ ] Domínio customizado conectado (se aplicável).
- [ ] Backup/export de dados antes de migrações destrutivas.

---

## 11. Troubleshooting

| Sintoma                                           | Causa provável                                        | Ação                                                                                |
| ------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 404 em refresh de rota                            | Rota não declarada                                    | Verifique `src/routes/<arquivo>.tsx` e `createFileRoute(...)`.                      |
| `Unauthorized` em server fn protegida             | Bearer não anexado                                    | Confirme `attachSupabaseAuth` em `src/start.ts → functionMiddleware`.               |
| `permission denied for table X`                   | Falta `GRANT`                                         | Adicione `GRANT` na migração e reaplique.                                           |
| `build:dev exited with code 1: Unauthorized`      | Loader público chamando fn com `requireSupabaseAuth`  | Mova a chamada para componente (`useServerFn`) ou para rota sob `_authenticated/`.  |
| `[unenv] X is not implemented`                    | Pacote Node-only no Worker                            | Troque por lib edge-compatível.                                                     |
| OAuth Google falha em preview                     | Não usou `lovable.auth.signInWithOAuth`               | Use o broker do Lovable.                                                            |
| GitHub não sincroniza                             | App Lovable desautorizado                             | Reconecte em **+ → GitHub → Connect project**.                                      |

---

**Documentação oficial:** <https://docs.lovable.dev>
