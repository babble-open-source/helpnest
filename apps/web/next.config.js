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
