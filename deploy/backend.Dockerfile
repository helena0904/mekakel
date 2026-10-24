FROM node:22-bookworm-slim AS base
WORKDIR /app

RUN apt-get update
&& apt-get install -y --no-install-recommends openssl ca-certificates
&& rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM deps AS build
COPY backend/prisma.config.ts backend/tsconfig.json ./
COPY backend/prisma ./prisma

RUN DATABASE_URL="postgresql://build@localhost:5432/mekakel" npx prisma generate

COPY backend/ ./
RUN npm run build

FROM deps AS migrate
COPY backend/prisma.config.ts ./
COPY backend/prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

FROM deps AS runtime
ENV NODE_ENV=production

COPY backend/prisma.config.ts ./
COPY backend/prisma ./prisma

RUN DATABASE_URL="postgresql://build@localhost:5432/mekakel" npx prisma generate

COPY --from=build /app/dist ./dist

RUN npm prune --omit=dev
&& npm cache clean --force
&& mkdir -p /app/private-uploads
&& chown -R node /app

USER node

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]