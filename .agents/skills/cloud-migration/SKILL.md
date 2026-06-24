---
name: Cloud Migration
description: Guia completo passo a passo para migrar do Supabase Cloud gerenciado pelo Lovable para sua própria instância: exporta o schema e os dados, recria as Edge Functions, atualiza as variáveis de ambiente, configura Auth com domínio customizado, e valida tudo após a migração. Inclui árvore de decisão para manter o Lovable como IDE ou trocar de plataforma.
---

Guide me through migrating this project from Lovable Cloud to my own Supabase.

Start by asking me which path I want:
(A) Keep using Lovable as my IDE but connect my own Supabase project
(B) Fully migrate to another IDE (Cursor, Claude Code, VS Code)

Then walk me through these steps in order:

1. ENABLE GITHUB INTEGRATION — Make sure the project is connected to GitHub so I can export the code.

2. EXPORT DATA FROM LOVABLE CLOUD — Since there is no direct SQL access to Lovable Cloud, guide me through the available export methods: using the Lovable chat to ask for a data dump, or using any available export endpoints.

3. CREATE NEW SUPABASE PROJECT — Guide me to create a free Supabase project at supabase.com. Help me set up the project name, region, and password.

4. IMPORT SCHEMA — Recreate the database schema in the new Supabase project. Generate the CREATE TABLE statements based on the current codebase.

5. MIGRATE DATA — Help me import the exported data into the new Supabase tables.

6. UPDATE ENVIRONMENT VARIABLES — Update all Supabase URLs, anon keys, and service role keys in the project to point to the new Supabase project.

7. MIGRATE STORAGE FILES — Guide me to download files from Lovable Cloud storage and re-upload them to the new Supabase Storage buckets.

8. NOTIFY USERS — Remind me that auth passwords cannot be exported. Draft an email to notify users they need to reset their password after the migration.

IMPORTANT: Lovable Cloud cannot be disconnected once enabled. The workaround for path A is: create a new blank Lovable project → import GitHub repo → connect own Supabase.
