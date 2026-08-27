# Multi-stage Dockerfile for Orvexa Unified Full-Stack Platform with TrueForge Sandbox Support
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install native build tools for node-gyp / better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package descriptors and lockfile
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY scripts/patch-kysely.cjs ./scripts/

# Install build dependencies
RUN npm ci

# Copy source trees
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
COPY apps/web ./apps/web

# Build shared, server, and web
RUN npm run build

# Prune devDependencies while keeping compiled native modules intact
RUN npm prune --omit=dev

# Production runner image with native Linux SRT sandbox dependencies
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install Bubblewrap, Socat, Ripgrep, curl and CA certificates for TrueForge agent sandboxing
RUN apt-get update && apt-get install -y --no-install-recommends \
    bubblewrap \
    socat \
    ripgrep \
    curl \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=10000

# Copy package descriptors
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Copy compiled and pruned node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built outputs from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist

EXPOSE 10000

CMD ["node", "apps/server/dist/index.js"]


