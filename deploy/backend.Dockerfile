# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://build:build@localhost:5432/mekakel" npx prisma generate
COPY . .
RUN npm run build

FROM deps AS migrate
COPY prisma.config.ts ./
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

FROM deps AS runtime
ENV NODE_ENV=production
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://build:build@localhost:5432/mekakel" npx prisma generate
COPY --from=build /app/dist ./dist
RUN npm prune --omit=dev \
    && npm cache clean --force \
    && mkdir -p /app/private-uploads \
    && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]