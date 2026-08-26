# Multi-stage Dockerfile for Orvexa Unified Full-Stack Platform
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors and lockfile
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY scripts/patch-kysely.cjs ./scripts/

# Install dependencies
RUN npm ci

# Copy source trees
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
COPY apps/web ./apps/web

# Build shared, server, and web
RUN npm run build

# Production runner image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Copy root package files
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY scripts/patch-kysely.cjs ./scripts/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built outputs from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist

EXPOSE 10000

CMD ["node", "apps/server/dist/index.js"]
