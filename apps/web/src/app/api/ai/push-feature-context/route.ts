import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import type { CodeContext } from '@/lib/article-drafter'

const PENDING_DRAFT_TTL = 24 * 60 * 60 // 24 hours in seconds

const MAX_CONTEXTS_PER_FEATURE = 20

interface PendingDraftEntry {
  workspaceId: string
  collectionId?: string
  authorId?: string
  contexts: CodeContext[]
  lastUpdatedAt: number
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

  const { featureId, collectionId, codeContext } = body as {
    featureId?: unknown
    collectionId?: unknown
    codeContext?: unknown
  }

  if (!featureId || typeof featureId !== 'string' || featureId.trim().length === 0) {
    return NextResponse.json({ error: 'featureId is required' }, { status: 400 })
  }

  // Validate featureId to prevent Redis key injection.
  // Only allow alphanumeric characters, hyphens, underscores, and forward slashes (max 128 chars).
  const trimmedFeatureId = featureId.trim()
  if (trimmedFeatureId.length > 128 || !/^[a-zA-Z0-9_\-/]+$/.test(trimmedFeatureId)) {
    return NextResponse.json(
      { error: 'featureId may only contain alphanumeric characters, hyphens, underscores, and forward slashes (max 128 chars)' },
      { status: 400 },
    )
  }

  if (!codeContext || typeof codeContext !== 'object' || Array.isArray(codeContext)) {
    return NextResponse.json({ error: 'codeContext is required' }, { status: 400 })
  }

  const ctx = codeContext as Record<string, unknown>
  if (!ctx.prTitle || typeof ctx.prTitle !== 'string') {
    return NextResponse.json({ error: 'codeContext.prTitle is required' }, { status: 400 })
  }

  // Check workspace allows external drafting
  const workspace = await prisma.workspace.findUnique({
    where: { id: authResult.workspaceId },
    select: { autoDraftExternalEnabled: true, aiEnabled: true },
  })

  if (!workspace?.aiEnabled) {
    return NextResponse.json({ error: 'AI is not enabled for this workspace' }, { status: 403 })
  }

  if (!workspace.autoDraftExternalEnabled) {
    return NextResponse.json({ error: 'External API drafting is disabled' }, { status: 403 })
  }

  const normalizedContext: CodeContext = {
    prTitle: String(ctx.prTitle).slice(0, 200),
    prBody: typeof ctx.prBody === 'string' ? ctx.prBody.slice(0, 2000) : undefined,
    diff: typeof ctx.diff === 'string' ? ctx.diff.slice(0, 5000) : undefined,
    changedFiles: Array.isArray(ctx.changedFiles)
      ? (ctx.changedFiles as unknown[]).filter((f): f is string => typeof f === 'string').slice(0, 50)
      : undefined,
    repository: typeof ctx.repository === 'string' ? ctx.repository.slice(0, 200) : undefined,
    prUrl: typeof ctx.prUrl === 'string' ? ctx.prUrl.slice(0, 500) : undefined,
  }

  const redisKey = `pending-draft:${authResult.workspaceId}:${trimmedFeatureId}`

  if (!redis) {
    return NextResponse.json(
      { error: 'Multi-repo batching requires Redis. Configure REDIS_URL.' },
      { status: 503 },
    )
  }

  try {
    const existing = await redis.get(redisKey)
    let entry: PendingDraftEntry

    if (existing) {
      entry = JSON.parse(existing) as PendingDraftEntry
      if (entry.contexts.length < MAX_CONTEXTS_PER_FEATURE) {
        entry.contexts.push(normalizedContext)
      }
      entry.lastUpdatedAt = Date.now()
    } else {
      entry = {
        workspaceId: authResult.workspaceId,
        collectionId: typeof collectionId === 'string' ? collectionId : undefined,
        authorId: authResult.userId,
        contexts: [normalizedContext],
        lastUpdatedAt: Date.now(),
      }
    }

    await redis.set(redisKey, JSON.stringify(entry), 'EX', PENDING_DRAFT_TTL)

    return NextResponse.json({
      queued: true,
      featureId: trimmedFeatureId,
      contextsCollected: entry.contexts.length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Redis error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 503 },
    )
  }
}
