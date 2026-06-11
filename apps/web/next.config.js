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
    'livekit-server-sdk',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Playwright-core must be fully external — serverExternalPackages alone
      // doesn't prevent webpack from resolving its transitive deps (chromium-bidi).
      config.externals = config.externals || []
      config.externals.push('playwright-core')
    }
    return config
  },
  async rewrites() {
    return [{ source: '/widget.js', destination: '/api/widget.js' }]
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
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Content-Security-Policy
          // Notes:
          // - next/font/google downloads fonts at build time and self-hosts them, so no
          //   runtime requests to fonts.googleapis.com are needed.
          // - 'unsafe-inline' and 'unsafe-eval' are required by Next.js App Router (inline
          //   theme scripts, HMR in dev, React hydration).
          // - https://unpkg.com in script-src covers the react-grab dev tool loaded in layout.tsx.
          // - wss: in connect-src covers Next.js HMR WebSocket.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = withNextIntl(nextConfig)
