# ── Stage: base ───────────────────────────────────────────────────────────────
FROM node:20-slim AS base

RUN apt-get update && apt-get install -y openssl

WORKDIR /app
COPY package*.json ./

# ── Stage: all deps ───────────────────────────────────────────────────────────
FROM base AS all-deps
RUN npm ci

# ── Stage: prod deps only ─────────────────────────────────────────────────────
FROM base AS prod-deps
RUN npm ci --omit=dev

# ── Stage: builder ────────────────────────────────────────────────────────────
FROM all-deps AS builder

COPY . .

# IMPORTANT
RUN npx prisma generate

RUN npm run build

# ── Stage: dev ────────────────────────────────────────────────────────────────
FROM all-deps AS dev

COPY prisma ./prisma

RUN npx prisma generate

ENV NODE_ENV=development

EXPOSE 4000

CMD ["npm", "run", "start:dev"]

# ── Stage: preprod ────────────────────────────────────────────────────────────
FROM node:20-slim AS preprod

RUN apt-get update && apt-get install -y openssl

WORKDIR /app

ENV NODE_ENV=staging

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4001/api/gold-rates || exit 1

CMD ["node", "dist/main"]

# ── Stage: prod ───────────────────────────────────────────────────────────────
FROM node:20-slim AS prod

RUN apt-get update && apt-get install -y openssl

WORKDIR /app

ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 nestjs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

USER nestjs

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4001/api/gold-rates || exit 1

CMD ["node", "dist/main"]