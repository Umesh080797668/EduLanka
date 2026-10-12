# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — Analytics Microservice (apps/analytics)
# Multi-stage build: deps → build → production (P3-S9)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate
WORKDIR /app

# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/analytics/package.json ./apps/analytics/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ── Stage 2: Build shared packages + Analytics service ────────────────────────
FROM deps AS builder
COPY packages/ ./packages/
COPY apps/analytics/ ./apps/analytics/
RUN pnpm --filter @edu-lanka/shared-types build
RUN pnpm --filter @edu-lanka/analytics build

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8083

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --from=builder /app/apps/analytics/dist ./apps/analytics/dist
COPY --from=builder /app/apps/analytics/package.json ./apps/analytics/
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile --filter @edu-lanka/analytics...

EXPOSE 8083
USER node

CMD ["node", "apps/analytics/dist/main.js"]
