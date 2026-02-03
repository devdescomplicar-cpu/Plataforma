# ============================================================
# Stage 1: Build do frontend (Vite + React)
# ============================================================
FROM node:20-alpine AS frontend

WORKDIR /app

# Build args: mesma URL que você coloca no Easypanel (Environment) para o front já sair com a URL certa
ARG VITE_APP_URL=
ARG VITE_API_URL=
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json* ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json tailwind.config.ts postcss.config.js ./
COPY src ./src
COPY public ./public

RUN npm run build

# ============================================================
# Stage 2: Build do server (Express + Prisma)
# ============================================================
FROM node:20-alpine AS server

WORKDIR /app

COPY server/package*.json ./server/
WORKDIR /app/server

RUN npm ci

COPY server/prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma

COPY server/tsconfig.json ./
COPY server/src ./src

RUN npm run build

# Remover devDependencies para imagem final menor
RUN npm prune --omit=dev

# ============================================================
# Stage 3: Imagem de produção
# ============================================================
FROM node:20-alpine AS production

WORKDIR /app

# Prisma no Alpine precisa de libc e OpenSSL 3 (binaryTargets = linux-musl-openssl-3.0.x)
RUN apk add --no-cache libc6-compat openssl

# Frontend estático (build do Vite)
COPY --from=frontend /app/dist ./dist

# Server: código compilado e node_modules (apenas produção)
COPY --from=server /app/server/node_modules ./server/node_modules
COPY --from=server /app/server/dist ./server/dist
COPY --from=server /app/server/package.json ./server/
COPY server/prisma ./server/prisma

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check (opcional; Easypanel pode usar para checagem)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://localhost:3000/health || exit 1

# Migrações: resolve P3009 (migrações falhas) se existirem, depois deploy + app na porta 3000
CMD ["sh", "-c", "cd /app/server && (npx prisma migrate resolve --rolled-back '20250130000000_webhook_base' 2>/dev/null || true) && (npx prisma migrate resolve --rolled-back '20260130031208_add_vehicle_version' 2>/dev/null || true) && npx prisma migrate deploy --schema=prisma/schema.prisma && exec node dist/app.js"]
