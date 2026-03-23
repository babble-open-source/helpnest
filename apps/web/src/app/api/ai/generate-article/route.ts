import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import { draftArticle, DraftError } from '@/lib/article-drafter'
import { isByok } from '@/lib/ai/resolve-provider'
import { checkLimit, incrementUsage } from '@/lib/cloud'
import type { CodeContext } from '@/lib/article-drafter'

// Default rate limit — admins can override per-workspace via dashboard AI settings
const DEFAULT_RATE_LIMIT = 50
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

async function cacheIdempotent(workspaceId: string, key: string, result: object): Promise<void> {
  if (!redis || !key) return
  await redis.set(
    `idempotent:generate-article:${workspaceId}:${key}`,
    JSON.stringify(result),
    'EX', 86400,
  ).catch(() => {})
}

// In-memory fallback used when Redis is unavailable.
// Tracks per-workspace request counts within the current time slot.
const _articleMemFallback = new Map<string, number>()

async function checkRateLimit(workspaceId: string, max: number): Promise<{ limited: boolean }> {
  if (redis) {
    try {
      const slot = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS)
      const key = `rl:generate-article:${workspaceId}:${slot}`
      const count = await redis.incr(key)
      if (count === 1) await redis.pexpire(key, RATE_LIMIT_WINDOW_MS * 2)
      return { limited: count > max }
    } catch {
      // Redis unavailable — fall through to in-memory fallback
    }
  }
  // In-memory fallback: rate-limit per process when Redis is down.
  // This is a best-effort secondary control; a cold restart resets the counter.
  const now = Date.now()
  const slot = Math.floor(now / RATE_LIMIT_WINDOW_MS)
  const memKey = `${workspaceId}:${slot}`
  const current = _articleMemFallback.get(memKey) ?? 0
  if (current >= max) return { limited: true }
  _articleMemFallback.set(memKey, current + 1)
  // Prune stale slots to prevent unbounded memory growth
  for (const k of _articleMemFallback.keys()) {
    if (!k.endsWith(`:${slot}`)) _articleMemFallback.delete(k)
  }
  return { limited: false }
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const {
    topic,
    gapIds,
    collectionId,
    idempotencyKey,
    codeContext,
  } = body as {
    topic?: unknown
    gapIds?: unknown
    collectionId?: unknown
    idempotencyKey?: unknown
    codeContext?: unknown
  }

  // Rate limit — check before any DB query to reduce load under abuse
  const rate = await checkRateLimit(authResult.workspaceId, DEFAULT_RATE_LIMIT)
  if (rate.limited) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Maximum ${DEFAULT_RATE_LIMIT} drafts per hour per workspace.` },
      { status: 429 },
    )
  }

  // Single workspace query — all fields needed for auth, credits, and drafting
  const workspace = await prisma.workspace.findUnique({
    where: { id: authResult.workspaceId },
    select: {
      aiApiKey: true,
      aiDraftRateLimit: true,
      autoDraftExternalEnabled: true,
      aiEnabled: true,
      productContext: true,
      aiInstructions: true,
      aiProvider: true,
      aiModel: true,
    },
  })

  // Per-workspace rate limit may be stricter than the default — re-check if needed
  const workspaceLimit = workspace?.aiDraftRateLimit ?? DEFAULT_RATE_LIMIT
  if (workspaceLimit < DEFAULT_RATE_LIMIT) {
    const wsRate = await checkRateLimit(authResult.workspaceId, workspaceLimit)
    if (wsRate.limited) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Maximum ${workspaceLimit} drafts per hour per workspace.` },
        { status: 429 },
      )
    }
  }

  // Check AI credit quota — BYOK allowed for self-hosted, PRO, BUSINESS
  const creditLimit = await checkLimit(authResult.workspaceId, 'aiCredits')
  const byokAllowed = creditLimit.plan === 'SELF_HOSTED' || creditLimit.plan === 'PRO' || creditLimit.plan === 'BUSINESS'
  if (!isByok({ aiApiKey: workspace?.aiApiKey ?? null }, { byok: byokAllowed })) {
    if (!creditLimit.allowed) {
      return NextResponse.json(
        { error: 'AI credit limit reached for this month. Upgrade your plan or add your own API key.' },
        { status: 429 },
      )
    }
    incrementUsage(authResult.workspaceId, 'aiCredits')
  }

  if (!workspace?.aiEnabled) {
    return NextResponse.json({ error: 'AI is not enabled for this workspace' }, { status: 403 })
  }

  // Only enforce autoDraftExternalEnabled for API key auth (not session)
  if (authResult.via === 'apikey' && !workspace.autoDraftExternalEnabled) {
    return NextResponse.json(
      { error: 'External API drafting is disabled for this workspace' },
      { status: 403 },
    )
  }

  // Idempotency check
  if (idempotencyKey && typeof idempotencyKey === 'string' && redis) {
    try {
      const cached = await redis.get(`idempotent:generate-article:${authResult.workspaceId}:${idempotencyKey}`)
      if (cached) {
        return NextResponse.json(JSON.parse(cached))
      }
    } catch {
      // Redis unavailable — proceed without idempotency
    }
  }

  // Input validation and sanitization
  const normalizedTopic =
    typeof topic === 'string' ? topic.trim().slice(0, 500) : undefined

  let codeContexts: CodeContext[] | undefined
  if (codeContext && typeof codeContext === 'object' && !Array.isArray(codeContext)) {
    const ctx = codeContext as Record<string, unknown>
    const prTitle = typeof ctx.prTitle === 'string' ? ctx.prTitle.slice(0, 200) : ''
    if (prTitle) {
      codeContexts = [{
        prTitle,
        prBody: typeof ctx.prBody === 'string' ? ctx.prBody.slice(0, 60000) : undefined, // ~15K tokens — main code context from CLI
        diff: typeof ctx.diff === 'string' ? ctx.diff.slice(0, 10000) : undefined, // ~2.5K tokens — git diff
        changedFiles: Array.isArray(ctx.changedFiles)
          ? (ctx.changedFiles as unknown[]).filter((f): f is string => typeof f === 'string').slice(0, 50)
          : undefined,
        commitMessages: Array.isArray(ctx.commitMessages)
          ? (ctx.commitMessages as unknown[]).filter((m): m is string => typeof m === 'string').slice(0, 20).map((m) => m.slice(0, 100))
          : undefined,
        currentFiles: Array.isArray(ctx.currentFiles)
          ? (ctx.currentFiles as unknown[])
              .filter((f): f is { path: string; content: string } => {
                if (typeof f !== 'object' || f === null) return false
                const o = f as Record<string, unknown>
                return typeof o.path === 'string' && typeof o.content === 'string'
              })
              .slice(0, 5)
              .map((f) => ({ path: f.path.slice(0, 200), content: f.content.slice(0, 5000) })) // ~1.25K tokens per file
          : undefined,
        repository: typeof ctx.repository === 'string' ? ctx.repository.slice(0, 200) : undefined,
        prUrl: typeof ctx.prUrl === 'string' ? ctx.prUrl.slice(0, 500) : undefined,
      }]
    }
  }

  const normalizedCollectionId =
    typeof collectionId === 'string' ? collectionId : undefined

  if (!normalizedTopic && !codeContexts && (!Array.isArray(gapIds) || gapIds.length === 0)) {
    return NextResponse.json(
      { error: 'Provide topic, codeContext, or gapIds' },
      { status: 400 },
    )
  }

  // Draft first gap if gapIds provided
  if (Array.isArray(gapIds) && gapIds.length > 0) {
    const gapId = gapIds[0] as string
    const gap = await prisma.knowledgeGap.findFirst({
      where: { id: gapId, workspaceId: authResult.workspaceId },
      select: { id: true, query: true },
    })
    if (!gap) {
      return NextResponse.json(
        { error: `Knowledge gap not found: ${gapId}` },
        { status: 404 },
      )
    }
    try {
      const result = await draftArticle({
        workspaceId: authResult.workspaceId,
        collectionId: normalizedCollectionId,
        authorId: authResult.userId,
        gap: { id: gap.id, query: gap.query },
        workspaceSettings: workspace,
      })
      await cacheIdempotent(authResult.workspaceId, idempotencyKey as string, result)
      return NextResponse.json(result)
    } catch (err) {
      const status = err instanceof DraftError ? err.statusCode : 500
      const message = err instanceof Error ? err.message : 'Draft generation failed'
      return NextResponse.json({ error: message }, { status })
    }
  }

  try {
    const result = await draftArticle({
      workspaceId: authResult.workspaceId,
      collectionId: normalizedCollectionId,
      authorId: authResult.userId,
      topic: normalizedTopic,
      codeContexts,
      bypassThreshold: true,
      workspaceSettings: workspace,
    })
    await cacheIdempotent(authResult.workspaceId, idempotencyKey as string, result)
    return NextResponse.json(result)
  } catch (err) {
    const status = err instanceof DraftError ? err.statusCode : 500
    const message = err instanceof Error ? err.message : 'Draft generation failed'
    return NextResponse.json({ error: message }, { status })
  }
}
