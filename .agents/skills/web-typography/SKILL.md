---
name: Web Typography
description: Sistema tipográfico completo para web: escalas Major Third e Perfect Fourth, corpo mínimo 16px, altura de linha 1.5–1.75, comprimento ideal de linha 45–75ch, e carregamento performático via WOFF2 com font-display:swap. Define hierarquia entre no máximo 2 famílias tipográficas e entrega o CSS de implementação pronto.
---

Review and improve the typography of this project.

1. FONT AUDIT — What fonts are currently loaded? Are they served from Google Fonts, self-hosted, or system fonts? How many font families and weights are loaded? (More than 3 families or 6 weight variants = performance risk).

2. TYPOGRAPHIC SCALE — Is there a consistent type scale? Recommended: 12px / 14px / 16px / 18px / 20px / 24px / 30px / 36px / 48px / 60px / 72px (or a modular scale with ratio 1.25 or 1.333). Are all font sizes in rem (not px)?

3. LINE HEIGHT & LINE LENGTH — Body text line-height: 1.5–1.7. Headings: 1.1–1.3. Line length (measure): 60–75 characters (45–85 acceptable). Set max-width on text containers.

4. FONT PAIRING — Is the heading font visually distinct from the body font? Good pairing rules: contrast in personality (geometric + humanist), contrast in weight, same era. If using a single font family, use different weights and sizes to create hierarchy.

5. FLUID TYPOGRAPHY — Implement clamp() for at least the h1, h2, and body text: h1: clamp(2rem, 5vw + 1rem, 4rem), h2: clamp(1.5rem, 3vw + 0.75rem, 2.5rem), body: clamp(1rem, 1.5vw, 1.125rem).

6. PERFORMANCE — Are fonts loaded with font-display: swap? Is font preloading implemented for critical fonts (<link rel="preload">)? Are unused font weights removed from the Google Fonts URL?

Provide the corrected CSS and Google Fonts import URL.
