# # ─── Stage 1: Builder ────────────────────────────────────────────────────────
# # Installs ALL dependencies and compiles TypeScript to JavaScript
# FROM node:20-alpine AS builder

# WORKDIR /app

# # Copy package files first — Docker caches this layer
# # Only re-runs npm install when package.json changes
# COPY package.json yarn.lock ./

# # Install ALL dependencies including devDependencies (needed for TypeScript)
# RUN yarn install --frozen-lockfile

# # Copy source code
# COPY . .

# # Compile TypeScript → JavaScript into /app/dist
# RUN yarn tsc --project tsconfig.json

# # Fix path aliases — tsc compiles @/shared/* etc but doesn't resolve them
# # tsc-alias resolves the path aliases in the compiled output
# RUN yarn tsc-alias -p tsconfig.json

# # ─── Stage 2: Production ─────────────────────────────────────────────────────
# # Lean production image — no TypeScript compiler, no dev dependencies
# FROM node:20-alpine AS production

# WORKDIR /app

# # Install build tools for native modules like argon2
# RUN apk add --no-cache python3 make g++

# # Install PM2 globally — process manager for Node.js
# RUN npm install -g pm2

# # Copy package files
# COPY package.json yarn.lock ./

# # Install ONLY production dependencies — no devDependencies
# RUN yarn install --frozen-lockfile --production

# # Copy compiled JavaScript from builder stage
# COPY --from=builder /app/dist ./dist

# # Copy PM2 config
# COPY ecosystem.config.js ./

# # Copy any other files needed at runtime
# COPY .env.example ./

# # Create a non-root user for security
# # Never run Node.js as root in production
# RUN mkdir -p logs && \
#     addgroup -g 1001 -S nodejs && \
#     adduser -S nodeuser -u 1001 -G nodejs && \
#     chown -R nodeuser:nodejs /app

# USER nodeuser

# # Expose app port
# EXPOSE 5000

# # Health check — Docker will restart container if this fails
# HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
#   CMD wget -qO- http://localhost:5000/health || exit 1

# # Start app with PM2
# CMD ["pm2-runtime", "ecosystem.config.js"]


# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn tsc --project tsconfig.json
RUN yarn tsc-alias -p tsconfig.json

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ wget && rm -rf /var/lib/apt/lists/*

RUN npm install -g pm2

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY --from=builder /app/dist ./dist
COPY ecosystem.config.js ./
COPY .env.example ./

RUN mkdir -p logs && \
    groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh -m nodeuser && \
    chown -R nodeuser:nodejs /app

USER nodeuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["pm2-runtime", "ecosystem.config.js"]