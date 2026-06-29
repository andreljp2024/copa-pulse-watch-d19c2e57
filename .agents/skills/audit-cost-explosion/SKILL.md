---
name: audit-cost-explosion
description: "Identifica riscos de custos descontrolados antes que a fatura chegue: APIs de IA (OpenAI, Anthropic etc.) sem rate limit ou teto de gasto, queries sem paginação retornando milhares de registros, uploads sem limite de tamanho, Edge Functions sem timeout, e serviços pagos sem controle de consumo por usuário. Sugere o código de proteção para cada risco encontrado."
---

Audit this project for cost explosion risks. Check the following in order of severity. Some settings live in provider dashboards, not in code — when you cannot verify from code, tell me exactly where to check.

1. AI PROVIDER COSTS
   Identify which AI APIs this app calls (OpenAI, Anthropic, Google AI, Replicate, etc.). For each:

- Check for request-level cost controls (token limits, max retries, timeout)
- Can a single user trigger unlimited AI calls (spamming a button, looping requests)?
- Tell me exactly where to set spending limits: OpenAI → platform.openai.com/settings/organization/limits, Anthropic → console.anthropic.com/settings/limits. Ask me to confirm limits are set.

2. HOSTING COSTS
   Identify the hosting platform (Vercel, Netlify, Railway, etc.). Check for:

- Serverless functions that could be triggered at scale
- Bandwidth-heavy operations (file uploads, streaming) with no limits
- Database operations on pay-per-use plans
- Tell me where to find spending caps for my platform and ask me to confirm.

3. PER-USER LIMITS
   Check if the app has per-user rate limiting in the code:

- Can one user make unlimited requests to expensive endpoints?
- Is there a daily or monthly cap per user?
- Is there any usage tracking in the database?
  Flag if there is no per-user limiting at all.

4. SPAM PROTECTION
   Check API routes for rate limiting middleware:

- Can someone send 1,000 requests per second to any endpoint?
- Are there rate limiters (express-rate-limit, upstash ratelimit, etc.)?
- Are login/signup endpoints protected against brute force?

For each finding: Number, Severity (CRITICAL/HIGH/OK), file and line, what's wrong, what could happen, how to fix.
Sort by severity. IMPORTANT: Audit only — do NOT modify code.
