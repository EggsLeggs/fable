FROM node:20-alpine AS base

# --- prune: isolate workspace subset ---
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@2
COPY . .
RUN turbo prune @fable/worker --docker

# --- install + build: compile worker TypeScript ---
FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
COPY .npmrc .
COPY scripts ./scripts
RUN npm ci
COPY --from=pruner /app/out/full/ .
RUN npm run build --workspace=@fable/worker

# --- runner: minimal production image ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 worker

COPY --from=builder --chown=worker:nodejs /app .

USER worker

CMD ["npm", "run", "start", "--workspace=@fable/worker"]
