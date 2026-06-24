# ---------- Bolão SaaS — Dockerfile para Coolify / self-hosting ----------
# Build multi-stage: instala deps, gera o build de produção (preset Node)
# e roda o servidor TanStack Start em runtime Node 20 enxuto.
#
# IMPORTANTE: este projeto usa Nitro (via @lovable.dev/vite-tanstack-config).
# O preset padrão é cloudflare. Para rodar em Node (Coolify / VPS / Docker),
# defina NITRO_PRESET=node-server no build (já feito abaixo).

# 1) Dependências ------------------------------------------------------------
FROM oven/bun:1.1 AS deps
WORKDIR /app
COPY package.json bun.lockb* bunfig.toml* ./
RUN bun install --frozen-lockfile || bun install

# 2) Build -------------------------------------------------------------------
FROM oven/bun:1.1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis públicas (VITE_*) precisam estar presentes no build.
# No Coolify, defina-as em "Build Variables".
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    NITRO_PRESET=node-server

RUN bun run build

# 3) Runtime -----------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Output do Nitro (preset node-server) fica em .output/
COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
