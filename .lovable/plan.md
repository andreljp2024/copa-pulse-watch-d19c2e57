## Problema

Hoje todo bolão de um tenant mostra **todos** os jogos da base no link público. O gestor não consegue agendar um bolão para uma rodada específica nem ter links diferentes apontando para conjuntos distintos de jogos. O criativo do hero usa um “próximo jogo qualquer” em vez das seleções realmente agendadas.

## Solução

Tornar a seleção de jogos parte do bolão (persistida) e fazer o link público (e o criativo do hero) ler somente esses jogos. O gestor poderá ter vários bolões (cada um com seu slug e sua rodada de jogos).

### 1. Banco — tabela `bolao_matches`

Migration criando join table:

- `bolao_matches(bolao_id uuid, match_id uuid, created_at)` com PK composta, FKs para `boloes(id)` e `matches(id)` com `ON DELETE CASCADE`.
- GRANT padrão (`authenticated` CRUD, `service_role` ALL, `anon` apenas SELECT — leitura pública faz parte do link compartilhável).
- RLS:
  - `SELECT` público: `EXISTS (boloes b WHERE b.id = bolao_id AND b.status='active')`.
  - `INSERT/UPDATE/DELETE`: só o dono do tenant do bolão (`current_tenant_id() = b.tenant_id`) ou `super_admin`.
- Ajustar `submit_palpite(...)` para exigir que `match_id` pertença ao bolão (se houver vínculos cadastrados); se a tabela estiver vazia para aquele bolão, manter o comportamento atual (compatível).

### 2. Admin — `src/routes/_authenticated/app.bolao.tsx`

- Carregar `bolao_matches` ao abrir o bolão e popular `selectedMatchIds`.
- Botão **Salvar** passa a persistir o conjunto (`delete` + `insert` em transação client-side: apaga removidos, insere adicionados).
- Reorganizar a aba **Config**: bloco “Jogos deste bolão” com a lista de jogos futuros e checkbox; resumo (“X jogos selecionados”).
- Permitir **criar novo bolão** (já existe estrutura; expor botão “Novo bolão” se ainda não houver) para que o gestor tenha mais de um link.

### 3. Público — `src/routes/bolao.$slug.tsx`

- No `queryFn`, buscar primeiro os `match_id`s em `bolao_matches` para o bolão; se houver, filtrar `matches` por esses IDs. Se a lista estiver vazia (bolão antigo), manter fallback atual.
- `featured` passa a ser calculado dentro desse subconjunto (mostra o próximo jogo agendado **do bolão**).
- Hero/criativo: quando há um `featured`, exibir bandeiras + nomes (em PT-BR via `ptTeamName`) das duas seleções com placar previsto/scoreboard, em vez do bloco genérico “Vai, Brasil”. Mantém estética samba/dourada.
- og:image / og:title incluem nomes das seleções do próximo jogo (`Brasil x Argentina — {nome do bolão}`) para o preview do link no WhatsApp refletir o confronto.

### 4. Detalhes técnicos

- Reaproveitar `ptTeamName` para nomes nas metatags e no hero.
- `FeaturedMatchCard` permanece, mas recebe sempre o jogo do bolão (não do global).
- Nada muda em rotas autenticadas além do `app.bolao.tsx`.
- Sem mudança de business logic em palpites além da validação de pertencimento dentro de `submit_palpite`.

## Arquivos

- `supabase/migrations/<novo>.sql` — tabela `bolao_matches`, GRANTs, RLS, update em `submit_palpite`.
- `src/routes/_authenticated/app.bolao.tsx` — carregar/salvar vínculos, UI de seleção de jogos do bolão, criar novo bolão.
- `src/routes/bolao.$slug.tsx` — filtrar matches pelo vínculo, ajustar hero/criativo e metatags por seleções.
