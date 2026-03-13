import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import { draftArticle } from '@/lib/article-drafter'

interface PendingDraftEntry {
  workspaceId: string
  collectionId?: string
  authorId?: string
  contexts: Array<{
    prTitle: string
    prBody?: string
    diff?: string
    changedFiles?: string[]
    repository?: string
    prUrl?: string
  }>
  lastUpdatedAt: number
}

function timingSafeEqual(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  // Accept INTERNAL_SECRET header (cron) or authenticated session (admin manual trigger)
  const internalSecret = request.headers.get('x-internal-secret')
  const configuredSecret = process.env.INTERNAL_SECRET
  let isInternalCall = false
  let callerWorkspaceId: string | undefined

  if (internalSecret && configuredSecret && timingSafeEqual(internalSecret, configuredSecret)) {
    // Authorized via internal secret — may process all workspaces
    isInternalCall = true
  } else {
    const authResult = await requireAuth(request)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Session / API key callers may only process their own workspace's pending drafts
    callerWorkspaceId = authResult.workspaceId
  }

  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  const generated: Array<{ featureId: string; articleId: string; mode: string }> = []
  const errors: Array<{ featureId: string; error: string }> = []

  // Scope the Redis SCAN to the caller's workspace when not an internal call.
  // This prevents a session/API-key caller from processing other workspaces' drafts.
  const scanPattern = isInternalCall
    ? 'pending-draft:*'
    : `pending-draft:${callerWorkspaceId}:*`

  try {
    // Scan for pending draft keys scoped to the authorised workspace (or all for cron)
    let cursor = '0'
    const keysToProcess: string[] = []

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', scanPattern, 'COUNT', 100)
      cursor = nextCursor
      keysToProcess.push(...keys)
    } while (cursor !== '0')

    for (const key of keysToProcess) {
      try {
        // Atomic: get and check, then delete if ready
        const raw = await redis.get(key)
        if (!raw) continue

        const entry = JSON.parse(raw) as PendingDraftEntry

        // Check workspace batch window
        const workspace = await prisma.workspace.findUnique({
          where: { id: entry.workspaceId },
          select: { batchWindowMinutes: true, aiEnabled: true },
        })

        if (!workspace?.aiEnabled) continue

        const batchWindowMs = (workspace.batchWindowMinutes ?? 60) * 60 * 1000
        const elapsed = Date.now() - entry.lastUpdatedAt

        if (elapsed < batchWindowMs) continue // still within batch window

        // Pop the entry atomically (delete before processing to prevent double-processing)
        const deleted = await redis.del(key)
        if (!deleted) continue // another process beat us to it

        // Extract featureId from key: pending-draft:{workspaceId}:{featureId}
        const parts = key.split(':')
        const featureId = parts.slice(2).join(':')

        const result = await draftArticle({
          workspaceId: entry.workspaceId,
          collectionId: entry.collectionId,
          authorId: entry.authorId,
          codeContexts: entry.contexts,
        })

        if (result) {
          generated.push({ featureId, articleId: result.articleId, mode: result.mode })
        }
      } catch (err) {
        errors.push({
          featureId: key,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Redis scan failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 503 },
    )
  }

  return NextResponse.json({ generated, errors, processedAt: new Date().toISOString() })
}
