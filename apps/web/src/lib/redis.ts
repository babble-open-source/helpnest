import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis: Redis | null | undefined }

function createRedis(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url) return null
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
  })
  // Suppress unhandled error events — callers catch errors at the call site.
  client.on('error', () => {})
  return client
}

export const redis: Redis | null =
  globalForRedis.redis !== undefined ? globalForRedis.redis : createRedis()

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis
