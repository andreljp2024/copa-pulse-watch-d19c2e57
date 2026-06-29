---
name: Audit: Monitoring & Recovery
description: Mapeia os pontos cegos de observabilidade e resiliência do projeto: ausência de páginas de erro e tratamento de exceções assíncronas, falta de integração com Sentry ou similar, ausência de monitoramento de uptime, backups do banco não configurados, e projeto sem controle de versão adequado. Entrega um plano de implementação com o código necessário para cobrir cada ponto cego.
---

Audit this project for blind spots in monitoring and recovery. Check in order of severity. When you cannot verify from code, tell me exactly where to check.

1. ERROR HANDLING
   Check if the app has a custom 404 page or error boundary component. What happens when a user visits a URL that does not exist? Does it show a helpful error page or crash/blank/raw error?

2. ERROR MONITORING
   Search the codebase for error tracking integration (Sentry, LogRocket, Bugsnag). Look for Sentry DSN, error reporting initialization, or similar setup. If nothing is found, flag it.

3. UPTIME MONITORING
   Check for health check endpoints or monitoring SDK integration. Then ask me: Do you use an uptime monitoring service (UptimeRobot, Pingdom, Better Uptime)? Does anyone get alerted when your app goes down? If not, tell me the simplest free options.

4. DATABASE BACKUPS
   Identify the database (Supabase, Firebase, PlanetScale, etc.). Backup settings live in the provider dashboard. Tell me where to check: Supabase → dashboard.supabase.com > Project Settings > Database > Backups. Ask me to confirm backups are enabled.

5. VERSION CONTROL
   Check for a .git directory or GitHub integration. If the code only exists inside the builder tool, ask me: Is this project connected to GitHub? If not, walk me through how to connect it.

For each finding: Number, Severity (CRITICAL/HIGH/OK), file and line (if applicable), what's wrong, what could happen, how to fix.
Sort by severity. IMPORTANT: Audit only — do NOT modify code.
