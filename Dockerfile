FROM node:22-alpine3.21 AS builder

# Update packages and install security updates, add build tools for native modules
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    python3 \
    make \
    g++ \
    sqlite \
    postgresql-dev

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (without running prepare script)
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

# Copy source code
COPY . .

# Build the project
RUN npm run build

FROM node:22-alpine3.21 AS release

# Update packages and install security updates, add runtime dependencies for SQLite, PostgreSQL and build tools
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    postgresql-client \
    libpq \
    python3 \
    make \
    g++

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package*.json /app/

ENV NODE_ENV=production

WORKDIR /app

# Install production dependencies and rebuild native modules for target architecture
RUN --mount=type=cache,target=/root/.npm npm ci --only=production --ignore-scripts

# Rebuild native modules for the target architecture
RUN npm rebuild better-sqlite3 pg

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app
USER nextjs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "node", "dist/index.js"]