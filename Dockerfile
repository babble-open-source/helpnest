# syntax=docker/dockerfile:1
# Target platform: linux/amd64 (GKE nodes are AMD64).
# Build from Mac ARM with: docker build --platform linux/amd64 ...
# The deploy-helpnest.sh script passes --platform linux/amd64 automatically.

# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Pin to the version declared in package.json packageManager field.
# "latest" risks silent breakage when pnpm ships a major release.
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace manifests first — this layer is cached until deps change.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* ./
COPY apps/web/package.json        ./apps/web/
COPY packages/db/package.json     ./packages/db/
COPY packages/ui/package.json     ./packages/ui/
COPY packages/widget/package.json ./packages/widget/
COPY packages/config/package.json ./packages/config/

# Install all workspace dependencies.
RUN pnpm install --frozen-lockfile

# Copy full source (.env files excluded by .dockerignore).
COPY . .

# Generate Prisma client (TypeScript source → packages/db/generated/prisma/).
# Runs inside the container so the schema-engine binary matches the target platform.
RUN cd packages/db && pnpm exec prisma generate

# Compile @helpnest/db TypeScript → packages/db/dist/ (CJS + ESM + seed.js).
# dist/seed.js is the compiled seed script used in both local dev and production.
RUN pnpm --filter @helpnest/db build

# NEXT_PUBLIC_* vars are baked into the client bundle at build time.
# Pass --build-arg NEXT_PUBLIC_APP_URL=https://your-domain.com when building
# for a non-localhost deployment (deploy-helpnest.sh does this automatically).
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm --filter @helpnest/widget build
RUN cd apps/web && pnpm build

# Stage the Prisma CLI dependency tree needed by the runner's init container
# to run `prisma migrate deploy`. Only schema-engine (migration binary) is
# required — the query engine is now WASM and lives in @prisma/client/runtime/.
RUN node -e " \
  const { cpSync, mkdirSync, existsSync } = require('fs'); \
  const path = require('path'); \
  const dbPaths = ['/app/packages/db']; \
  const cp = (src, dst) => cpSync(src, dst, { recursive: true, dereference: true }); \
  const resolvePkgDir = (name, paths) => { \
    let dir = path.dirname(require.resolve(name + '/package.json', { paths })); \
    while (!existsSync(path.join(dir, 'package.json'))) { \
      const parent = path.dirname(dir); \
      if (parent === dir) throw new Error('Could not find package root for ' + name); \
      dir = parent; \
    } \
    return dir; \
  }; \
  const copyPkg = (name, outDir, fromPaths) => { \
    const src = resolvePkgDir(name, fromPaths ?? dbPaths); \
    const dst = path.join(outDir, ...name.split('/')); \
    mkdirSync(path.dirname(dst), { recursive: true }); \
    cp(src, dst); \
  }; \
  const cliOut = '/tmp/prisma-cli-node_modules'; \
  mkdirSync(cliOut, { recursive: true }); \
  const prismaDir = resolvePkgDir('prisma', dbPaths); \
  const prismaNodeModules = path.join(prismaDir, 'node_modules'); \
  copyPkg('prisma', cliOut); \
  copyPkg('@prisma/engines', cliOut, [prismaNodeModules]); \
  copyPkg('@prisma/client', cliOut); \
  copyPkg('@prisma/adapter-pg', cliOut); \
  copyPkg('pg', cliOut); \
  copyPkg('@prisma/config', cliOut, [prismaNodeModules]); \
  copyPkg('@prisma/debug', cliOut, [prismaNodeModules]); \
  copyPkg('@prisma/fetch-engine', cliOut, [prismaNodeModules]); \
  copyPkg('@prisma/get-platform', cliOut, [prismaNodeModules]); \
  copyPkg('@prisma/engines-version', cliOut, [prismaNodeModules]); \
"

# ─── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache openssl \
 && addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js standalone output (includes traced node_modules for the app server).
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static     ./apps/web/.next/static
RUN mkdir -p ./packages/widget/dist
COPY --from=builder /app/apps/web/public              ./apps/web/public
COPY --from=builder /app/packages/widget/dist/widget.js ./packages/widget/dist/widget.js

# @helpnest/db compiled runtime — loaded by the app via serverExternalPackages.
# Standalone tracing may include this, but we copy explicitly as a safety net.
COPY --from=builder /app/packages/db/dist       ./packages/db/dist
COPY --from=builder /app/packages/db/index.d.ts ./packages/db/index.d.ts
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json

# Prisma schema, migrations, compiled seed, and package.json.
# package.json must be present so `prisma db seed` reads the correct
# "prisma.seed" config ("node prisma/seed.js") from the right location.
COPY --from=builder /app/packages/db/prisma        ./packages/db/prisma
COPY --from=builder /app/packages/db/dist/seed.js  ./packages/db/dist/seed.js

# Prisma CLI + schema-engine binary for `prisma migrate deploy`,
# plus @prisma/client (WASM runtime) and @prisma/adapter-pg for the seed.
# pg is a native module — resolved from the standalone node_modules trace.
COPY --from=builder /tmp/prisma-cli-node_modules/ ./packages/db/node_modules/

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1

CMD ["node", "apps/web/server.js"]
