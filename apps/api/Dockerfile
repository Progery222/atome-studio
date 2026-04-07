FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all dependencies (needed for workspace resolution)
RUN npm install --ignore-scripts

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Generate Prisma client BEFORE TypeScript compilation
RUN cd apps/api && npx prisma generate

# Build shared first, then api
RUN npm run build -w packages/shared
RUN npm run build -w apps/api

# Production image
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Prisma schema + migrations (needed for migrate deploy at runtime)
COPY apps/api/prisma ./apps/api/prisma

# Prisma generated client binary from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 3001

# Run migrations, seed admin (idempotent), then start
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node --transpile-only prisma/seed.ts || true && node dist/main"]
