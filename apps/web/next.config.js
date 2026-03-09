const fs = require('fs')
const path = require('path')

// Load the monorepo root .env so we only need to maintain one env file.
// Uses only built-in Node.js modules — no dotenv dependency required.
// apps/web/.env.local can still override individual vars for local dev.
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
  transpilePackages: ['@helpnest/ui', '@helpnest/db'],
  experimental: {
    serverComponentsExternalPackages: [
      '@prisma/client',
      'prisma',
      '@qdrant/js-client-rest',
      'undici',
      'openai',
      '@anthropic-ai/sdk',
      '@helpnest/themes',
    ],
  },
}

module.exports = nextConfig
