# Sansol CRM — imagem de produção (Next.js standalone)
FROM node:20-alpine AS base

# ── deps ──────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── build ─────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runtime ───────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 sansol

# Build standalone do Next.js (server.js + node_modules mínimos)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=sansol:nodejs /app/.next/standalone ./
COPY --from=builder --chown=sansol:nodejs /app/.next/static ./.next/static

# Scripts de banco (db:push / db:seed) e schema, para rodar via `docker exec`
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/node_modules/.bin/drizzle-kit ./node_modules/.bin/drizzle-kit
COPY --from=builder /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx

# pgdata (banco PGlite local) fica num volume — sobrevive a rebuilds
RUN mkdir -p /app/pgdata && chown sansol:nodejs /app/pgdata

USER sansol
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
