

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
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["pm2-runtime", "ecosystem.config.js"]
