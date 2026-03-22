import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'
import { qdrant, COLLECTION_NAME } from '@/lib/qdrant'

const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/**
 * POST /api/internal/purge-expired
 * Finds and hard-deletes all workspaces soft-deleted more than 30 days ago.
 * Called by helpnest-cloud cron daily.
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

  const cutoff = new Date(Date.now() - EXPIRY_MS)
  const expired = await prisma.workspace.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { id: true },
    take: 100, // batch limit — cron runs daily, will catch the rest next time
  })

  const purged: string[] = []
  for (const ws of expired) {
    try {
      // Delete Qdrant vectors (best-effort)
      if (qdrant) {
        await qdrant.delete(COLLECTION_NAME, {
          filter: {
            must: [{ key: 'workspaceId', match: { value: ws.id } }],
          },
        }).catch((err) => console.error(`[purge-expired] Qdrant error for ${ws.id}:`, err))
      }

      // Hard delete — Postgres cascades all child records
      await prisma.workspace.delete({ where: { id: ws.id } })
      purged.push(ws.id)
    } catch (err) {
      console.error(`[purge-expired] Failed to purge workspace ${ws.id}:`, err)
      // continue to next workspace
    }
  }

  if (purged.length > 0) {
    console.info(`[purge-expired] Hard-deleted ${purged.length} workspace(s): ${purged.join(', ')}`)
  }

  return NextResponse.json({ purged: purged.length, workspaceIds: purged })
}
