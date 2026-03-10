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
COPY apps/web/package.json     ./apps/web/
COPY packages/db/package.json  ./packages/db/
COPY packages/ui/package.json  ./packages/ui/
COPY packages/config/package.json ./packages/config/

# Install all workspace dependencies.
# Cache ID is scoped to TARGETPLATFORM so AMD64 and ARM64 builds never
# share a pnpm store (native binaries are platform-specific).
ARG TARGETPLATFORM
RUN --mount=type=cache,id=helpnest-pnpm-${TARGETPLATFORM},target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy full source (.env files excluded by .dockerignore).
COPY . .

# Generate Prisma client.
# prisma generate runs inside the AMD64 container so the correct native
# query engine binary is produced for the target platform.
RUN cd packages/db && pnpm prisma generate

# Stage the generated Prisma client plus a flat Prisma CLI node_modules tree.
# resolvePkgDir walks up from the resolved entry point to find the package root,
# which is necessary because pnpm resolves some packages to sub-paths.
RUN node -e " \
  const { cpSync, mkdirSync, existsSync } = require('fs'); \
  const path = require('path'); \
  const dbPaths = ['/app/packages/db']; \
  const cp = (src, dst) => cpSync(src, dst, { recursive: true, dereference: true }); \
  const resolvePkgDir = (name, paths) => { \
    let dir = path.dirname(require.resolve(name, { paths })); \
    while (!existsSync(path.join(dir, 'package.json'))) { \
      const parent = path.dirname(dir); \
      if (parent === dir) throw new Error('Could not find package root for ' + name); \
      dir = parent; \
    } \
    return dir; \
  }; \
  const copyPkg = (pkgDir, name, outDir) => { \
    const dst = path.join(outDir, ...name.split('/')); \
    mkdirSync(path.dirname(dst), { recursive: true }); \
    cp(pkgDir, dst); \
  }; \
  const clientDir = resolvePkgDir('@prisma/client', dbPaths); \
  cp(path.join(clientDir, '../..', '.prisma'), '/tmp/generated-prisma-client'); \
  const cliOut = '/tmp/prisma-cli-node_modules'; \
  mkdirSync(cliOut, { recursive: true }); \
  const prismaDir = resolvePkgDir('prisma', dbPaths); \
  const prismaNodeModules = path.dirname(path.dirname(prismaDir)); \
  const enginesDir = resolvePkgDir('@prisma/engines', [prismaNodeModules]); \
  const enginesNodeModules = path.dirname(path.dirname(enginesDir)); \
  copyPkg(prismaDir, 'prisma', cliOut); \
  copyPkg(enginesDir, '@prisma/engines', cliOut); \
  copyPkg(resolvePkgDir('@prisma/debug', [enginesNodeModules]), '@prisma/debug', cliOut); \
  copyPkg(resolvePkgDir('@prisma/fetch-engine', [enginesNodeModules]), '@prisma/fetch-engine', cliOut); \
  copyPkg(resolvePkgDir('@prisma/get-platform', [enginesNodeModules]), '@prisma/get-platform', cliOut); \
  copyPkg(resolvePkgDir('@prisma/engines-version', [enginesNodeModules]), '@prisma/engines-version', cliOut); \
  copyPkg(clientDir, '@prisma/client', cliOut); \
"

# Compile seed.ts to a self-contained JS bundle.
# esbuild is a dep of tsx and is fully installed (including @esbuild/linux-x64)
# in the builder stage by pnpm. bcryptjs is bundled inline. @prisma/client
# stays external and resolves from packages/db/node_modules at runtime.
# The runner needs no tsx, no esbuild, and no platform-specific binaries to seed.
RUN node -e " \
  const path = require('path'); \
  const dbPaths = ['/app/packages/db']; \
  const tsxDir = path.dirname(require.resolve('tsx/package.json', { paths: dbPaths })); \
  const esbuild = require(require.resolve('esbuild', { paths: [tsxDir] })); \
  esbuild.buildSync({ \
    entryPoints: ['/app/packages/db/prisma/seed.ts'], \
    bundle: true, \
    platform: 'node', \
    target: 'node20', \
    external: ['@prisma/client'], \
    outfile: '/tmp/seed.js', \
  }); \
"

# NEXT_PUBLIC_* vars are baked into the client bundle at build time.
# Pass --build-arg NEXT_PUBLIC_APP_URL=https://your-domain.com when building
# for a non-localhost deployment (deploy-helpnest.sh does this automatically).
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN cd apps/web && pnpm build

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
RUN mkdir -p ./apps/web/public

# Prisma schema, migrations, compiled seed, and package.json.
# package.json must be present so `prisma db seed` reads the correct
# "prisma.seed" config ("node prisma/seed.js") from the right location.
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/prisma       ./packages/db/prisma
COPY --from=builder /tmp/seed.js                  ./packages/db/prisma/seed.js

# Prisma CLI dependency tree (prisma, engines, debug, fetch-engine, get-platform,
# engines-version, @prisma/client) — all copied as real files, no pnpm symlinks.
COPY --from=builder /tmp/prisma-cli-node_modules/ ./packages/db/node_modules/

# Copy the generated Prisma client (query engine binary + generated types) to
# both locations that Prisma searches at runtime:
#   packages/db/node_modules/.prisma  — initContainer (migrate / seed)
#   apps/web/.prisma                  — Next.js app server (standalone searches here)
COPY --from=builder /tmp/generated-prisma-client ./packages/db/node_modules/.prisma
COPY --from=builder /tmp/generated-prisma-client ./apps/web/.prisma

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
