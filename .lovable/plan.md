# Plano de Adaptação: Futebol Brasileiro (Clubes)

Adaptação completa do sistema Bolão AI para o contexto de futebol brasileiro, substituindo todas as referências residuais à Copa do Mundo por termos e lógicas voltadas a clubes e campeonatos nacionais.

## 1. Interface e Terminologia (Frontend)
- Renomear "Seleções" para "Times" em todos os menus, títulos e labels.
- Atualizar metadados (SEO) para focar em campeonatos brasileiros.
- Ajustar textos de hero e banners para remover o foco em "Copa do Mundo" e "Hexa", substituindo por "Jogão" e "Vitória".
- Garantir que a home e o dashboard organizador reflitam a nova temática.

## 2. Limpeza de Resíduos (Backend/Config)
- Remover qualquer arquivo residual do módulo CestaFácil que possa causar conflitos ou erros de importação.
- Ajustar os logs de sincronização e mensagens automáticas de WhatsApp.

## Detalhes Técnicos
- Edição de `src/lib/seo.ts`, `src/routes/index.tsx`, `src/components/AppShell.tsx` e rotas administrativas.
- Exclusão física de arquivos obsoletos sob `src/routes/cesta.*` e similares.
- Atualização da memória do projeto para garantir consistência futura.
