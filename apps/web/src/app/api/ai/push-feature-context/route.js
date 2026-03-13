import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-api';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
const PENDING_DRAFT_TTL = 24 * 60 * 60; // 24 hours in seconds
export async function POST(request) {
    const authResult = await requireAuth(request);
    if (!authResult) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let body;
    try {
        body = await request.json();
    }
    catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { featureId, collectionId, codeContext } = body;
    if (!featureId || typeof featureId !== 'string' || featureId.trim().length === 0) {
        return NextResponse.json({ error: 'featureId is required' }, { status: 400 });
    }
    if (!codeContext || typeof codeContext !== 'object' || Array.isArray(codeContext)) {
        return NextResponse.json({ error: 'codeContext is required' }, { status: 400 });
    }
    const ctx = codeContext;
    if (!ctx.prTitle || typeof ctx.prTitle !== 'string') {
        return NextResponse.json({ error: 'codeContext.prTitle is required' }, { status: 400 });
    }
    // Check workspace allows external drafting
    const workspace = await prisma.workspace.findUnique({
        where: { id: authResult.workspaceId },
        select: { autoDraftExternalEnabled: true, aiEnabled: true },
    });
    if (!workspace?.aiEnabled) {
        return NextResponse.json({ error: 'AI is not enabled for this workspace' }, { status: 403 });
    }
    if (!workspace.autoDraftExternalEnabled) {
        return NextResponse.json({ error: 'External API drafting is disabled' }, { status: 403 });
    }
    const normalizedContext = {
        prTitle: String(ctx.prTitle).slice(0, 200),
        prBody: typeof ctx.prBody === 'string' ? ctx.prBody.slice(0, 2000) : undefined,
        diff: typeof ctx.diff === 'string' ? ctx.diff.slice(0, 5000) : undefined,
        changedFiles: Array.isArray(ctx.changedFiles)
            ? ctx.changedFiles.filter((f) => typeof f === 'string').slice(0, 50)
            : undefined,
        repository: typeof ctx.repository === 'string' ? ctx.repository.slice(0, 200) : undefined,
        prUrl: typeof ctx.prUrl === 'string' ? ctx.prUrl.slice(0, 500) : undefined,
    };
    const redisKey = `pending-draft:${authResult.workspaceId}:${featureId.trim()}`;
    if (!redis) {
        return NextResponse.json({ error: 'Multi-repo batching requires Redis. Configure REDIS_URL.' }, { status: 503 });
    }
    try {
        const existing = await redis.get(redisKey);
        let entry;
        if (existing) {
            entry = JSON.parse(existing);
            entry.contexts.push(normalizedContext);
            entry.lastUpdatedAt = Date.now();
        }
        else {
            entry = {
                workspaceId: authResult.workspaceId,
                collectionId: typeof collectionId === 'string' ? collectionId : undefined,
                contexts: [normalizedContext],
                lastUpdatedAt: Date.now(),
            };
        }
        await redis.set(redisKey, JSON.stringify(entry), 'EX', PENDING_DRAFT_TTL);
        return NextResponse.json({
            queued: true,
            featureId: featureId.trim(),
            contextsCollected: entry.contexts.length,
        });
    }
    catch (err) {
        return NextResponse.json({ error: `Redis error: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 503 });
    }
}
