---
name: "Audit: Legal Risks"
description: "Verifica os requisitos legais antes de cobrar usuários: presença e qualidade da Política de Privacidade e Termos de Uso, conformidade com LGPD/GDPR, termos de propriedade de código das ferramentas de IA utilizadas (Lovable, Cursor etc.), e dependências open-source com licenças copyleft que podem exigir publicação do código-fonte. Indica o que está faltando e sugere textos e implementações necessários."
---

Audit this project for legal risks before charging users. Check the following in order of severity.

1. PRIVACY POLICY
Does this app have a privacy policy? Check for a /privacy or /privacy-policy route. Check the footer and signup/login pages for a link. If the app collects any user data and has no privacy policy, flag it.

2. CODE OWNERSHIP
Based on this project's framework and dependencies, identify which AI builder tools were likely used to generate it. For each one:
- What are the exact code ownership terms on my current plan? Do I own the code outright?
- Does the tool retain any rights to the generated code?
- Can it use my code for training?
- Are there restrictions on commercial use or resale?
- If terms differ by plan (free vs paid), tell me which plan grants full ownership.

3. COPYLEFT DEPENDENCIES
Scan package.json and lock files for dependencies with copyleft licenses (GPL, AGPL, LGPL, MPL). These can require you to release your source code under the same license. Check both direct and significant transitive dependencies.

For each finding: Number, Severity (CRITICAL/HIGH/OK), file and line (if applicable), what's wrong, what could happen, how to fix.
Sort by severity. IMPORTANT: Audit only — do NOT modify code.
