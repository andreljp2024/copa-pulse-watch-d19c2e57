# Plano de Adaptação Final - Futebol Brasileiro 2026

Migração completa da terminologia "Seleções" para "Times" e "Copa do Mundo" para "Futebol Brasileiro" em toda a interface e rotas.

## Alterações Realizadas

### 1. Sistema de Rotas
- Rota `/selecoes` renomeada para `/times`.
- Rota `/selecoes/$id` renomeada para `/times/$id`.
- Links internos no `AppShell` e componentes (como `StandingsTable` e `MatchCard`) atualizados.

### 2. Interface de Usuário (PT-BR)
- **Cabeçalho/Menu**: "Times" em vez de "Seleções".
- **Páginas de Listagem**: Títulos alterados para "Times".
- **SEO/Metadados**: Títulos das páginas e descrições OG atualizados para "Futebol Brasileiro 2026".
- **Calendário**: Tradução de "Copa do Mundo" para "Futebol Brasileiro 2026".
- **Bolões**: Templates e mensagens de compartilhamento atualizados.

### 3. Dados e Lógica
- Mantida a integração com `football-data.org` focada no Brasileirão Série A (`BSA`).
- Ajustadas as mensagens de placeholder em mata-mata para refletir "rodadas".

## Próximos Passos (PRD)
- Implementação de Estilos de Palpite (1X2, Over/Under) conforme PRD.
- Refinamento do PWA para experiência offline.

## Detalhes Técnicos
- Arquivos afetados: `src/routes/times.tsx`, `src/routes/times.$id.tsx`, `src/components/AppShell.tsx`, `src/components/StandingsTable.tsx`, `src/components/MatchCard.tsx`, `src/routes/calendario.tsx`, `src/routes/partidas.$id.tsx`, `src/routes/bolao.$slug.tsx`.
- Rotas TanStack atualizadas para refletir a nova estrutura de arquivos.
