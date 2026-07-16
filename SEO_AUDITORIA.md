# Auditoria de SEO — Bolão AI (`bolaoai-source`)

> Revisão técnica: On-page, Performance/Indexação e Dados Estruturados.
> Stack: TanStack Start (SSR) + Supabase. Domínio canônico: `https://bolao.ai.slz.br`

## 1. Resumo executivo

O projeto já possui base sólida de SEO (SSR real via TanStack Start, `lang="pt-BR"`,
Open Graph no root, `robots.txt`, `manifest`, `sitemap.xml` e cache de borda para
rotas públicas). No entanto, há **lacunas críticas que impedem boa indexação e
rich results**: ausência de `canonical`, ausência total de JSON-LD, sitemap
incompleto e inconsistências de metadados.

Prioridade de impacto: **Alta** (canonical + sitemap + JSON-LD) > **Média** (consistência OG/Twitter, meta robots) > **Baixa** (polish).

---

## 2. On-page técnico

### 2.1. `rel="canonical"` — ❌ AUSENTE (CRÍTICO)
Nenhuma rota emite `<link rel="canonical">`. Sem canonical, URLs com query string
(`?utm=`, `?ref=`), trailing slash ou parâmetros de sessão podem ser tratadas como
conteúdo duplicado, diluindo autoridade. O Google *tenta* inferir, mas não é garantido.

**Ação:** emitir canonical absoluto em `__root.tsx` (fallback) e sobrescrever por
rota quando houver parâmetros dinâmicos (ex.: `/bolao/$slug`).

### 2.2. Open Graph / Twitter — ⚠️ INCONSISTENTE
- O root define `og:title` e `og:image` corretos, mas várias rotas sobrescrevem
  apenas `og:title`/`og:description` e **esquecem `og:image`, `twitter:image` e
  `twitter:title/description`**. Resultado: compartilhamento em redes sem imagem.
- `index.tsx` define `og:description` como "Tudo da Copa em um só lugar." (genérico),
  ignorando a descrição rica da home.
- `/ajuda` só define `<title>`, sem description/OG.

**Ação:** criar helper `ogMeta()` e reutilizar em todas as rotas; garantir `og:image`
(1200×630) e `twitter:image` em todo lugar.

### 2.3. `meta robots` — ⚠️ FALTANDO EM PÁGINAS SENSÍVEIS
Rotas autenticadas (`_authenticated/*`) são SSR. Embora o `robots.txt` permita `/`,
não há `noindex` explícito nas áreas logadas, e o sitemap só lista 3 URLs públicas.
Se alguma rota autenticada vazar status 200 em URL discoverable, pode ser indexada.

**Ação:** adicionar `meta robots noindex` no layout autenticado.

### 2.4. `theme-color`, viewport, charset — ✅ OK
Já presentes no root.

---

## 3. Performance / Indexação

### 3.1. `sitemap.xml` — ❌ INCOMPLETO (CRÍTICO)
O sitemap em `src/routes/sitemap[.]xml.ts` lista apenas 3 URLs:
`/`, `/criar-bolao`, `/auth`. Faltam todas as páginas públicas indexáveis:
`/calendario`, `/grupos`, `/selecoes`, `/estatisticas`, `/mata-mata`, `/ajuda`,
`/planos` e, idealmente, cada `/bolao/$slug` público (dinâmico via Supabase).

**Ação:** expandir entradas estáticas e, opcionalmente, buscar bolões `active`
para incluir `/bolao/<slug>` e `/bolao/<slug>/ranking`.

### 3.2. Cache de borda / TTFB — ✅ BOM
`server.ts` já faz cache em memória (TTL 30s) de rotas públicas com `Cache-Control`
e header `X-Cache`. Isso ajuda Core Web Vitals (LCP). Recomenda-se manter e, em
produção atrás de CDN, propagar `Cache-Control` corretamente.

### 3.3. `robots.txt` — ✅ OK
Aponta para o sitemap correto. Sugestão: adicionar `Disallow` para áreas autenticadas
se expostas por URL (ex.: `/app`, `/admin`) por segurança defensiva.

### 3.4. Imagens e lazy-loading — ⚠️ MELHORÁVEL
- Várias `<img>` de bandeiras/times usam `loading` implícito; imagens acima da dobra
  (hero) sem `fetchpriority="high"` podem atrasar LCP.
- `og:image` do root aponta para URL do Lovable (`*.lovable.app`), que pode expirar
  ou ser bloqueada. **Recomenda-se hospedar imagem OG própria em `/public`.**

### 3.5. `hreflang` — ℹ️ OPCIONAL
Como o conteúdo é 100% `pt-BR`, não há necessidade imediata de `hreflang`, mas o
`<html lang="pt-BR">` está correto.

---

## 4. Dados estruturados (JSON-LD) — ❌ AUSENTE (CRÍTICO)

Nenhum schema.org é emitido. Para um portal de Copa/bolão, os seguintes tipos
elevariam CTR via rich results:

- **`WebSite`** + `SearchAction` (sitelinks search box) — no root.
- **`Organization`** / `SportsOrganization` — no root (marca Bolão AI).
- **`Event`** (`SportsEvent`) — em `/partidas/$id` e `/bolao/$slug` (jogo específico).
- **`SportsTournament`** — na home/calendário (Copa 2026).
- **`BreadcrumbList`** — em páginas internas.
- **`FAQPage`** — em `/ajuda` (já tem perguntas estruturadas! alto potencial).

**Ação:** criar `src/lib/seo.ts` com helpers `jsonLd()` e injetar via `<script
type="application/ld+json">` no `head` de cada rota.

---

## 5. Plano de correção (ordem de execução)

1. Criar `src/lib/seo.ts` (helpers: `SITE`, `canonicalMeta`, `ogMeta`, `jsonLd`, `noindexMeta`).
2. `__root.tsx`: canonical padrão + JSON-LD WebSite/Organization + OG/Twitter completos.
3. `sitemap[.]xml.ts`: incluir todas as rotas públicas + bolões ativos.
4. Rotas públicas: canonical + OG/Twitter consistentes + JSON-LD por tipo.
5. Layout autenticado: `meta robots noindex`.
6. `/ajuda`: adicionar `FAQPage` JSON-LD.
7. `robots.txt`: `Disallow` defensivo de áreas logadas.
8. Hospedar imagem OG própria (substituir URL Lovable).

## 6. Checklist de validação (pós-correção)

- [ ] `view-source:` de `/` mostra `<link rel="canonical">` e `<script type="application/ld+json">`.
- [ ] `https://bolao.ai.slz.br/sitemap.xml` lista todas as rotas públicas.
- [ ] Rich Results Test (Google) valida `FAQPage` em `/ajuda` e `Event` em partidas.
- [ ] `og:image` / `twitter:image` presentes em todas as rotas compartilháveis.
- [ ] Áreas `/app`, `/admin` retornam `noindex` no `view-source`.

---

## 7. Correções APLICADAS (commit pendente)

| Arquivo | O que foi feito |
| --- | --- |
| `src/lib/seo.ts` | **NOVO** helper central: `SITE`, `absoluteUrl`, `canonicalMeta`, `robotsMeta`, `noindexMeta`, `ogMeta` (OG+Twitter completos com imagem 1200×630 e dimensões), `jsonLd`. |
| `src/routes/__root.tsx` | Canonical `/`, OG/Twitter completos e consistentes (remove dependência da URL Lovable), `WebSite`+`SearchAction` e `Organization` JSON-LD no `<head>`. |
| `src/routes/sitemap[.]xml.ts` | Expandido para todas as rotas públicas + bolões `active` dinâmicos (`/bolao/<slug>`, `/bolao/<slug>/ranking`). |
| `src/routes/index.tsx` | Canonical + `ogMeta` + `SportsTournament` JSON-LD; corrigido `og:description` genérico. |
| `src/routes/bolao.$slug.tsx` | Canonical por slug + `ogMeta` (imagem = logo do bolão) + `SportsEvent` JSON-LD do próximo jogo. |
| `src/routes/ajuda.tsx` | Canonical + `ogMeta` + `FAQPage` JSON-LD (rico para sitelinks). |
| `src/routes/_authenticated/route.tsx` | `meta robots noindex` defensivo na área logada. |
| `public/robots.txt` | `Disallow` para `/app`, `/admin`, `/onboarding`, `/auth`. |
| `public/og-image.png` | **NOVO** imagem OG própria 1200×630 (`/og-image.png`), eliminando URL externa frágil. |

**Validação executada:** `tsc --noEmit` não acusa erros em nenhum arquivo alterado;
`eslint` dos arquivos alterados sem erros (apenas 1 warning inofensivo de react-refresh
em `__root.tsx`). Erros de `any`/prettier remanescentes em `index.tsx` são de código
**pré-existente** (JSX original), não das edições de SEO.

**Próximos passos recomendados (não bloqueantes):**
1. Substituir `og-image.png` por arte profissional (com logo + texto "Copa 2026").
2. Configurar CDN/cache `Cache-Control` em produção para propagar o cache de borda do `server.ts`.
3. Validar no Google Rich Results Test e Search Console após deploy.

---

## 8. Correções APLICADAS — 2ª leva (JSON-LD em páginas internas)

| Arquivo | O que foi feito |
| --- | --- |
| `src/routes/calendario.tsx` | Canonical + `ogMeta` + `SportsTournament` + `BreadcrumbList` JSON-LD. |
| `src/routes/selecoes.tsx` | Canonical + `ogMeta` + `BreadcrumbList` JSON-LD. |
| `src/routes/partidas.$slug.tsx` | **NOVO `head` dinâmico** com loaderData: canonical por id, `ogMeta` (título/descrição com adversários e data), `SportsEvent` JSON-LD (startDate, status, local, competidores) + `BreadcrumbList` (Início → Calendário → Partida). Fallback para partida não encontrada. |

**Validação:** `vite build` (SSR) concluído com **sucesso (exit 0)**; `tsc --noEmit`
sem erros nos arquivos alterados. Erros `no-explicit-any` remanescentes são de
`any` **pré-existentes** no corpo dos componentes (filtros/casts), não das inserções
de SEO.
