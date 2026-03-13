import Redis from 'ioredis';
const globalForRedis = globalThis;
function createRedis() {
    const url = process.env.REDIS_URL;
    if (!url)
        return null;
    const client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
    });
    // Suppress unhandled error events — callers catch errors at the call site.
    client.on('error', () => { });
    return client;
}
export const redis = globalForRedis.redis !== undefined ? globalForRedis.redis : createRedis();
if (process.env.NODE_ENV !== 'production')
    globalForRedis.redis = redis;
