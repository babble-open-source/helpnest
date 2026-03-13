import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-api';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { draftArticle } from '@/lib/article-drafter';
export async function GET(request) {
    // Accept INTERNAL_SECRET header (cron) or authenticated session (admin manual trigger)
    const internalSecret = request.headers.get('x-internal-secret');
    if (internalSecret && internalSecret === process.env.INTERNAL_SECRET) {
        // Authorized via internal secret
    }
    else {
        const authResult = await requireAuth(request);
        if (!authResult) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }
    if (!redis) {
        return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }
    const generated = [];
    const errors = [];
    try {
        // Scan for all pending draft keys
        let cursor = '0';
        const keysToProcess = [];
        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'pending-draft:*', 'COUNT', 100);
            cursor = nextCursor;
            keysToProcess.push(...keys);
        } while (cursor !== '0');
        for (const key of keysToProcess) {
            try {
                // Atomic: get and check, then delete if ready
                const raw = await redis.get(key);
                if (!raw)
                    continue;
                const entry = JSON.parse(raw);
                // Check workspace batch window
                const workspace = await prisma.workspace.findUnique({
                    where: { id: entry.workspaceId },
                    select: { batchWindowMinutes: true, aiEnabled: true },
                });
                if (!workspace?.aiEnabled)
                    continue;
                const batchWindowMs = (workspace.batchWindowMinutes ?? 60) * 60 * 1000;
                const elapsed = Date.now() - entry.lastUpdatedAt;
                if (elapsed < batchWindowMs)
                    continue; // still within batch window
                // Pop the entry atomically (delete before processing to prevent double-processing)
                const deleted = await redis.del(key);
                if (!deleted)
                    continue; // another process beat us to it
                // Extract featureId from key: pending-draft:{workspaceId}:{featureId}
                const parts = key.split(':');
                const featureId = parts.slice(2).join(':');
                const result = await draftArticle({
                    workspaceId: entry.workspaceId,
                    collectionId: entry.collectionId,
                    codeContexts: entry.contexts,
                });
                if (result) {
                    generated.push({ featureId, articleId: result.articleId, mode: result.mode });
                }
            }
            catch (err) {
                errors.push({
                    featureId: key,
                    error: err instanceof Error ? err.message : 'Unknown error',
                });
            }
        }
    }
    catch (err) {
        return NextResponse.json({ error: `Redis scan failed: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 503 });
    }
    return NextResponse.json({ generated, errors, processedAt: new Date().toISOString() });
}
