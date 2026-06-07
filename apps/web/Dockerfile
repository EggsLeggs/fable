FROM node:20-alpine AS base

# --- prune: isolate workspace subset ---
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@2
COPY . .
RUN node -e "const fs=require('fs'),p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.dependencies;fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
RUN turbo prune @fable/web --docker

# --- install: resolve deps from pruned lockfile ---
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
COPY .npmrc .
COPY scripts ./scripts
RUN npm ci
COPY --from=pruner /app/out/full/ .

# --- build: compile Next.js ---
FROM installer AS builder
RUN npm run build --workspace=@fable/web

# --- runner: minimal production image ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
