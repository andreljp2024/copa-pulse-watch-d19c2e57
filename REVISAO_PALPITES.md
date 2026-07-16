# Revisão do Módulo de Palpites — Bolão AI

> Revisão técnica de código (SQL + frontend/backend TS) do fluxo de palpites.
> Arquivos analisados: `supabase/migrations/*submit_palpite*`, `src/routes/bolao.$slug.tsx`,
> `src/routes/_authenticated/app.palpites.tsx`, `src/lib/ganhadores-list.functions.ts`,
> `src/routes/_authenticated/app.index.tsx`, `src/routes/_authenticated/app.bolao.tsx`.

## 1. Resumo

O módulo está maduro (rate limit, anti-fraude, MV de ranking, RLS por tenant). Foram
encontrados **2 bugs de negócio** e **1 melhoria de UX**, todos corrigidos nesta revisão.

## 2. Problemas encontrados e correções

### 2.1. ❌ Inconsistência no repasse do prêmio (BUG de negócio)
- **Público** (`bolao.$slug.tsx`): `premioEstimado = arrecadado * 0.9` → prometia **90%** aos torcedores.
- **Backend** (`ganhadores-list.functions.ts`, `app.index.tsx`): prêmio = `arrecadado * (1 - percentual_admin)` → **80%** quando `percentual_admin = 20`.
- Impacto: a página pública prometia 10% a mais do que o sistema realmente distribuía → risco de reclamação de torcedores.
- **Corrigido:** a página pública agora lê `bolao.percentual_admin` (já disponível na query do bolão) e calcula `arrecadado * (1 - pctAdmin/100)`. O texto "90% para premiação" virou "{100 - pctAdmin}% para premiação". Sem migration necessária.

### 2.2. ❌ Palpite duplicado quebra com erro genérico (UX/BUG)
- `submit_palpite` faz `INSERT` em `palpites` com `UNIQUE(torcedor_id, match_id)`. Se o torcedor já palpitou no mesmo jogo, o Postgres retorna erro 23505 sem mensagem amigável → usuário vê "Failed to fetch"/erro cru.
- **Corrigido:** nova migration `20260716121540_..._palpite_duplicado.sql` recria `submit_palpite` verificando palpite existente antes do INSERT e lançando `Você já registrou um palpite para este jogo neste bolão.` (ERRCODE `unique_violation`).

### 2.3. ⚠️ Validação de prazo usa `now()` do banco (OK, mas documentado)
- `submit_palpite` compara `kickoff_at <= now()` e `data_limite_palpite <= now()`. Como ambos são `timestamptz` (UTC), a comparação é correta independente de fuso. O frontend usa `Date.now() - 3h` (Brasil) apenas para UI. Sem mudança necessária, mas recomenda-se manter o DB em UTC.

## 3. Pontos revisados e considerados OK

| Item | Status | Observação |
| --- | --- | --- |
| RLS por tenant em `palpites` | ✅ | Policies corretas (anon insert, public read, tenant update/delete) |
| Rate limit (10/min/WhatsApp) | ✅ | `check_rate_limit` com janela de limpeza `×4` |
| `ON CONFLICT` em torcedores | ✅ | Idempotente por `bolao_id, whatsapp` |
| Validação de jogo no bolão (`bolao_matches`) | ✅ | Respeita vínculos quando existem |
| `app.palpites.tsx` (UI/admin) | ✅ | Filtros, CSV, PDF, aprovar/lembrar/cancelar consistentes |
| MV `mv_ranking_torcedores` + `get_bolao_ranking` | ✅ | Fallback STABLE; refresh a cada 5 min via pg_cron |
| `ganhadores-list.functions.ts` | ✅ | Arrecadado considera só `status_pagamento='pago'` |

## 4. Sugestões (não bloqueantes)

1. Padronizar o nome do campo: backend chama `percentual_admin` (fatia do organizador);
   a UI deveria sempre mostrar "Prêmio: X%" = `100 - percentual_admin`. Já feito na home pública.
2. Adicionar índice em `palpites(status_pagamento, bolao_id)` para acelerar contagem de pagos
   na página pública (hoje varre `palpites` do bolão).
3. O `submit_palpite` é `SECURITY DEFINER` — ok, mas `search_path = public` está definido (bom).
