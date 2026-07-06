FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (use webpack, not turbopack — turbopack breaks standalone output)
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

# Copy static files (public + .next/static)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# Copy scripts (ig-poster.js needed for local dev / Post Now flow)
COPY --from=builder /app/scripts ./scripts

# Copy Prisma schema for runtime
COPY --from=builder /app/prisma ./prisma

# Create temp dirs for queue
RUN mkdir -p /app/temp/ig-queue/pending /app/temp/ig-queue/done

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]