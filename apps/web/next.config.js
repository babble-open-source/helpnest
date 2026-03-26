const fs = require('fs')
const path = require('path')
const createNextIntlPlugin = require('next-intl/plugin')

// Load the monorepo root .env for local development only.
// In Docker/production, env vars come from the Kubernetes Secret — .env is
// excluded by .dockerignore so this block is a no-op in CI/CD builds.
// dotenv handles quoted values, multi-line strings, and special characters
// correctly — never override vars that are already set in the environment.
const rootEnv = path.resolve(__dirname, '../../.env')
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv, override: false })
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Required for monorepo: traces node_modules outside apps/web into standalone output.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@helpnest/ui'],
  serverExternalPackages: [
    '@helpnest/db',
    // Prisma must be external so the native query-engine binary is resolved at runtime,
    // not bundled by webpack (which cannot include platform-specific .node files).
    // @prisma/client is no longer listed directly — the generated client lives under
    // packages/db/generated/prisma and is accessed exclusively through @helpnest/db.
    'prisma',
    '@prisma/adapter-pg',
    'pg',
    '@qdrant/js-client-rest',
    'undici',
    'openai',
    '@anthropic-ai/sdk',
    '@helpnest/themes',
    'ioredis',
    '@google/generative-ai',
    '@notionhq/client',
    'notion-to-md',
    'jose',
    'playwright-core',
    '@helpnest/crawler',
  ],
  async rewrites() {
    return [
      { source: '/widget.js', destination: '/api/widget.js' },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // HSTS — safe to include; HTTPS termination happens at the reverse proxy.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
}

module.exports = withNextIntl(nextConfig)
