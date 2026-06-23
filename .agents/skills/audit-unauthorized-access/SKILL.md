---
name: Audit: Unauthorized Access
description: Audita todo o controle de acesso do projeto: rotas e páginas acessíveis sem autenticação, falhas de autorização onde um usuário acessa dados de outro (IDOR), ausência de validação de input em formulários e APIs, escalação de privilégios via parâmetros manipulados, e endpoints administrativos expostos. Classifica cada falha por nível de risco (crítico/alto/médio) e entrega o código de correção.
---

Audit this project for unauthorized access. Check the following in order of severity.

1. OPEN ACCESS
Does this app require login? Check for an authentication system (login/signup page, auth provider like Supabase Auth, Firebase Auth, Clerk). If the app is wide open, flag critical.

2. UNPROTECTED ROUTES
Find every API route and page that accesses user data. Check if each one verifies the user is authenticated before returning data. Flag any route where an unauthenticated request would succeed.

3. DATA ACCESS BY ID
Check every route or query that loads data using an ID from the URL or request (e.g., /users/:id, /orders/:id). Does it verify the logged-in user owns that data, or can any logged-in user see anyone else's records by changing the ID? Flag any query that uses a user-supplied ID without checking ownership.

4. INPUT VALIDATION
Check all forms and API endpoints that accept user input. Are inputs validated before processing? Could someone submit a script tag, SQL query, or excessively long string?

5. ROLE-BASED ACCESS
If the app has different user types (admin, regular user, etc.), check if permissions are enforced server-side. Can a regular user access admin routes by changing the URL?

For each finding, report:
- Number (1, 2, 3...)
- Severity: CRITICAL, HIGH, or OK
- File and line number
- What's wrong (one sentence)
- What could happen if you don't fix it (one sentence)
- How to fix it and what could break (one sentence each)

Sort by severity, then by how fast it could hurt you.

IMPORTANT: This is an audit only. Do NOT modify any code.
