const fs = require('fs')
const path = require('path')

// Load the monorepo root .env for local development only.
// In Docker/production, env vars come from the Kubernetes Secret — .env is
// excluded by .dockerignore so this block is a no-op in CI/CD builds.
const rootEnv = path.resolve(__dirname, '../../.env')
if (fs.existsSync(rootEnv)) {
  for (const line of fs.readFileSync(rootEnv, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !(key in process.env)) process.env[key] = val
  }
}

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
    '@prisma/client',
    'prisma',
    '@qdrant/js-client-rest',
    'undici',
    'openai',
    '@anthropic-ai/sdk',
    '@helpnest/themes',
    'ioredis',
    '@google/generative-ai',
  ],
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

module.exports = nextConfig
