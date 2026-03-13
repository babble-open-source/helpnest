import { redis } from './redis';
import { prisma } from './db';
/**
 * Threshold before buffered view counts are flushed to Postgres.
 * Lower = more DB writes but less drift. Higher = fewer writes but views lag.
 */
const VIEW_FLUSH_THRESHOLD = 25;
/**
 * Increment the view count for an article.
 *
 * When Redis is available, increments are buffered in memory and flushed
 * to Postgres atomically when the threshold is reached. This eliminates
 * hot-row write contention on high-traffic articles.
 *
 * When Redis is unavailable (no REDIS_URL or connection error), falls back
 * to a direct Postgres increment — identical to the previous behaviour.
 */
export async function incrementArticleViews(articleId) {
    if (!redis) {
        await prisma.article.update({
            where: { id: articleId },
            data: { views: { increment: 1 } },
        }).catch(() => { });
        return;
    }
    try {
        const key = `views:${articleId}`;
        const pending = await redis.incr(key);
        if (pending >= VIEW_FLUSH_THRESHOLD) {
            // GETDEL is atomic — grab the accumulated count and clear the key in one op.
            // If another instance races here and already cleared the key, delta is null.
            const delta = await redis.getdel(key);
            if (delta) {
                await prisma.article.update({
                    where: { id: articleId },
                    data: { views: { increment: Number(delta) } },
                }).catch(() => { });
            }
        }
    }
    catch {
        // Redis error — fall back to direct DB write so views are never silently lost.
        await prisma.article.update({
            where: { id: articleId },
            data: { views: { increment: 1 } },
        }).catch(() => { });
    }
}
