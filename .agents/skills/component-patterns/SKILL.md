---
name: Component Patterns
description: Padrões de arquitetura de componentes modernos: composição sobre herança, compound components (Card.Header / Card.Body), sistema de tokens em três camadas (global / semântico / componente), variantes via CSS Custom Properties e troca de tema sem recarregar. Ideal para quem quer uma base de componentes reutilizável e escalável no Lovable.
---

Review and improve the component architecture of this project using modern composition patterns.

Analyze the codebase and provide recommendations for:

1. TOKEN SYSTEM — Are design tokens organized in 3 layers? Layer 1: raw values (--color-blue-500: #3b82f6). Layer 2: semantic (--color-primary: var(--color-blue-500)). Layer 3: component (--button-bg: var(--color-primary)). If not, restructure the token system.

2. COMPOUND COMPONENTS — Identify components that bundle too much logic. Suggest splitting into compound patterns: e.g., <Select.Root>, <Select.Trigger>, <Select.Content>, <Select.Item> instead of one monolithic <Select> with 20 props.

3. VARIANT SYSTEM — Are component variants defined declaratively (using cva, class-variance-authority, or Tailwind variants) or with scattered conditional classNames? Refactor the 3 most complex components to use a clean variant system.

4. FORM ARCHITECTURE — Are forms using React Hook Form + Zod for validation? If not, migrate the most complex form to this pattern and show the schema definition with proper error messages.

5. RESPONSIVE PATTERNS — Are components using container queries (@container) for intrinsic responsiveness, or only viewport-based media queries? Identify 2-3 card/grid components that would benefit from container queries.

6. THEMING — Is there a ThemeProvider or CSS class-based dark mode? Show how to implement dark mode variants using the existing token system.

Provide working code examples for each recommendation.
