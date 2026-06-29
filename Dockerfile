# ---------- Bolão SaaS — Dockerfile para Coolify / self-hosting ----------
# Build multi-stage: instala deps, gera o build de produção (preset Node)
# e roda o servidor TanStack Start em runtime Node 20 enxuto.
#
# IMPORTANTE: este projeto usa Nitro (via @lovable.dev/vite-tanstack-config).
# O preset padrão é cloudflare. Para rodar em Node (Coolify / VPS / Docker),
# defina NITRO_PRESET=node-server no build (já feito abaixo).

# 1) Dependências ------------------------------------------------------------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml* ./
RUN bun install --frozen-lockfile || bun install

FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NITRO_PRESET=node-server \
    VITE_SUPABASE_URL=https://bolao.ai.slz.br \
    VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgyNDM2NTkyLCJleHAiOjIwOTc3OTY1OTJ9.eTPHcqYLV7pvB21rSJTsPZLcFeozj10XfhQWUSynRdY

RUN bun run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
