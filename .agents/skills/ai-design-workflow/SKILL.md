---
name: AI Design Workflow
description: Framework para usar IA como assistente de design com limites bem definidos: estrutura de prompt (papel / contexto / tarefa / formato / restrições), implantação da IA por fase do projeto e fluxo de validação humana. Define onde a IA acelera o trabalho (geração de variantes, copy, assets) e onde a decisão criativa precisa ser do designer.
---

Help me integrate AI tools effectively into the design and development workflow for this project.

1. AI TOOL MAPPING — For each phase of the project, identify the best AI tool to use:
Research phase: AI for competitive analysis, persona generation, user story creation
Ideation: AI for layout concepts, color palette generation, copy suggestions  
Design: AI for image generation, icon creation, design system generation
Development: AI for component code generation, CSS optimization, accessibility fixes
Review: AI for design critique, conversion analysis, accessibility audit

2. STRUCTURED PROMPTING — For the 3 most common design tasks in this project, create optimized prompts:
- Image generation prompt (for hero/feature images): specify style, mood, subject, technical requirements
- Component generation prompt: specify component name, props, variants, accessibility requirements, Tailwind classes
- Copy/UX writing prompt: specify tone, audience, character limit, goal

3. AI REVIEW WORKFLOW — Set up a review checklist for AI-generated content before it goes live:
□ Factual accuracy checked by human
□ Brand voice consistency verified  
□ Accessibility requirements met
□ Legal/copyright cleared (especially for images)
□ Edge cases handled (empty state, error state, loading)

4. HUMAN + AI BOUNDARIES — Identify what should NOT be delegated to AI in this project:
- Strategic decisions (positioning, feature prioritization)
- Brand direction decisions
- Final accessibility review
- User testing

5. ITERATION SPEED — How can AI accelerate the current bottleneck in this project? Identify the slowest step (e.g., writing copy, creating components, testing responsiveness) and suggest the specific AI workflow to 10x that speed.

Provide an actionable AI workflow guide specific to this project.
