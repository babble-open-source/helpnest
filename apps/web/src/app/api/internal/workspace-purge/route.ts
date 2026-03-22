import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'
import { qdrant, COLLECTION_NAME } from '@/lib/qdrant'

/**
 * POST /api/internal/workspace-purge
 * Hard-deletes a single soft-deleted workspace and all child records.
 * Called by helpnest-cloud cron or purge-expired.
 * Body: { workspaceId }
 */
export async function POST(request: Request) {
  const configuredSecret = process.env.INTERNAL_SECRET
  if (!configuredSecret) {
    return NextResponse.json({ error: 'Internal secret not configured' }, { status: 503 })
  }
  const provided = request.headers.get('x-internal-secret')
  if (!provided) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const a = Buffer.from(provided)
  const b = Buffer.from(configuredSecret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workspaceId } = (await request.json()) as { workspaceId?: string }
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, deletedAt: true },
  })

  if (!workspace) {
    return NextResponse.json({ purged: true, reason: 'not_found' })
  }
  if (!workspace.deletedAt) {
    return NextResponse.json({ error: 'Workspace is not deleted — cannot purge' }, { status: 400 })
  }

  // Delete Qdrant vectors (best-effort)
  if (qdrant) {
    await qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [{ key: 'workspaceId', match: { value: workspaceId } }],
      },
    }).catch((err) => console.error('[workspace-purge] Qdrant error:', err))
  }

  // Hard delete — Postgres cascades all child records
  await prisma.workspace.delete({ where: { id: workspaceId } })

  console.info(`[workspace-purge] Hard-deleted workspace ${workspaceId}`)

  return NextResponse.json({ purged: true })
}
