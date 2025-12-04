# Multi-stage build for SIP Protocol REST API

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY packages/api/package.json ./packages/api/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/types/package.json ./packages/types/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/api ./packages/api
COPY packages/sdk ./packages/sdk
COPY packages/types ./packages/types
COPY tsconfig.json ./

# Build all packages
RUN pnpm --filter @sip-protocol/types build
RUN pnpm --filter @sip-protocol/sdk build
RUN pnpm --filter @sip-protocol/api build

# Stage 2: Production
FROM node:18-alpine AS runner

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml* ./
COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/sdk/package.json ./packages/sdk/
COPY --from=builder /app/packages/types/package.json ./packages/types/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "packages/api/dist/server.js"]
