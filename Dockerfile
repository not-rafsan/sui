FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json ./
RUN npm install

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create SQLite DB with tables (so it's ready at runtime)
RUN mkdir -p /app/data
ENV DATABASE_URL="file:/app/data/custom.db"
RUN npx prisma db push --skip-generate --accept-data-loss

# Build Next.js (use webpack, not turbopack)
RUN npx next build --webpack

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./

# Copy static files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema + generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy the pre-created SQLite DB with all tables
COPY --from=builder /app/data/custom.db /app/data/custom.db

# Create writable dirs and fix permissions
RUN mkdir -p /app/temp/ig-queue/pending /app/temp/ig-queue/done && \
    chown -R nextjs:nodejs /app/data /app/temp

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]