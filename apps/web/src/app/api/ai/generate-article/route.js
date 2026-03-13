import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-api';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { draftArticle } from '@/lib/article-drafter';
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
async function checkRateLimit(workspaceId) {
    if (redis) {
        try {
            const slot = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
            const key = `rl:generate-article:${workspaceId}:${slot}`;
            const count = await redis.incr(key);
            if (count === 1)
                await redis.pexpire(key, RATE_LIMIT_WINDOW_MS * 2);
            return { limited: count > RATE_LIMIT_MAX };
        }
        catch {
            // Redis unavailable — allow request
        }
    }
    return { limited: false };
}
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
    const { topic, gapIds, collectionId, idempotencyKey, codeContext, } = body;
    // Validate workspace is allowed to use external API drafting
    const workspace = await prisma.workspace.findUnique({
        where: { id: authResult.workspaceId },
        select: { autoDraftExternalEnabled: true, aiEnabled: true },
    });
    if (!workspace?.aiEnabled) {
        return NextResponse.json({ error: 'AI is not enabled for this workspace' }, { status: 403 });
    }
    // Only enforce autoDraftExternalEnabled for API key auth (not session)
    if (authResult.via === 'apikey' && !workspace.autoDraftExternalEnabled) {
        return NextResponse.json({ error: 'External API drafting is disabled for this workspace' }, { status: 403 });
    }
    // Rate limit
    const rate = await checkRateLimit(authResult.workspaceId);
    if (rate.limited) {
        return NextResponse.json({ error: 'Rate limit exceeded. Maximum 20 drafts per hour per workspace.' }, { status: 429 });
    }
    // Idempotency check
    if (idempotencyKey && typeof idempotencyKey === 'string' && redis) {
        try {
            const cached = await redis.get(`idempotent:generate-article:${authResult.workspaceId}:${idempotencyKey}`);
            if (cached) {
                return NextResponse.json(JSON.parse(cached));
            }
        }
        catch {
            // Redis unavailable — proceed without idempotency
        }
    }
    // Input validation and sanitization
    const normalizedTopic = typeof topic === 'string' ? topic.trim().slice(0, 500) : undefined;
    let codeContexts;
    if (codeContext && typeof codeContext === 'object' && !Array.isArray(codeContext)) {
        const ctx = codeContext;
        const prTitle = typeof ctx.prTitle === 'string' ? ctx.prTitle.slice(0, 200) : '';
        if (prTitle) {
            codeContexts = [{
                    prTitle,
                    prBody: typeof ctx.prBody === 'string' ? ctx.prBody.slice(0, 2000) : undefined,
                    diff: typeof ctx.diff === 'string' ? ctx.diff.slice(0, 5000) : undefined,
                    changedFiles: Array.isArray(ctx.changedFiles)
                        ? ctx.changedFiles.filter((f) => typeof f === 'string').slice(0, 50)
                        : undefined,
                    repository: typeof ctx.repository === 'string' ? ctx.repository.slice(0, 200) : undefined,
                    prUrl: typeof ctx.prUrl === 'string' ? ctx.prUrl.slice(0, 500) : undefined,
                }];
        }
    }
    const normalizedCollectionId = typeof collectionId === 'string' ? collectionId : undefined;
    if (!normalizedTopic && !codeContexts && (!Array.isArray(gapIds) || gapIds.length === 0)) {
        return NextResponse.json({ error: 'Provide topic, codeContext, or gapIds' }, { status: 400 });
    }
    // Draft first gap if gapIds provided
    if (Array.isArray(gapIds) && gapIds.length > 0) {
        const gapId = gapIds[0];
        const gap = await prisma.knowledgeGap.findFirst({
            where: { id: gapId, workspaceId: authResult.workspaceId },
            select: { id: true, query: true },
        });
        if (gap) {
            const result = await draftArticle({
                workspaceId: authResult.workspaceId,
                collectionId: normalizedCollectionId,
                authorId: authResult.userId,
                gap: { id: gap.id, query: gap.query },
                bypassThreshold: true,
            });
            if (result && idempotencyKey && typeof idempotencyKey === 'string' && redis) {
                await redis.set(`idempotent:generate-article:${authResult.workspaceId}:${idempotencyKey}`, JSON.stringify(result), 'EX', 86400).catch(() => { });
            }
            return result
                ? NextResponse.json(result)
                : NextResponse.json({ error: 'Draft generation failed' }, { status: 500 });
        }
    }
    const result = await draftArticle({
        workspaceId: authResult.workspaceId,
        collectionId: normalizedCollectionId,
        authorId: authResult.userId,
        topic: normalizedTopic,
        codeContexts,
        bypassThreshold: true,
    });
    if (!result) {
        return NextResponse.json({ error: 'Draft generation failed or was deduplicated' }, { status: 500 });
    }
    // Cache for idempotency
    if (idempotencyKey && typeof idempotencyKey === 'string' && redis) {
        await redis.set(`idempotent:generate-article:${authResult.workspaceId}:${idempotencyKey}`, JSON.stringify(result), 'EX', 86400).catch(() => { });
    }
    return NextResponse.json(result);
}
