import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'
import { isDemoMode } from '@/lib/demo'

type Action = 'delete' | 'publish' | 'archive' | 'draft'

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { ids?: unknown; action?: unknown }
  const { ids, action } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }
  if (!['delete', 'publish', 'archive', 'draft'].includes(action as string)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Verify all articles belong to this workspace
  const articles: Array<{ id: string; isSeeded: boolean }> = await prisma.article.findMany({
    where: { id: { in: ids as string[] }, workspaceId: authResult.workspaceId },
    select: { id: true, isSeeded: true },
  })

  if (articles.length === 0) {
    return NextResponse.json({ error: 'No articles found' }, { status: 404 })
  }

  const validIds = articles.map((a) => a.id)

  if (action === 'delete') {
    const demoMode = isDemoMode()
    const idsToDelete = demoMode
      ? validIds.filter((id) => !articles.find((a) => a.id === id)?.isSeeded)
      : validIds

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: 'Cannot delete seeded articles in demo mode' }, { status: 403 })
    }

    await prisma.$transaction([
      prisma.articleVersion.deleteMany({ where: { articleId: { in: idsToDelete } } }),
      prisma.article.deleteMany({ where: { id: { in: idsToDelete } } }),
    ])

    return NextResponse.json({ deleted: idsToDelete.length })
  }

  const statusMap: Record<Exclude<Action, 'delete'>, 'PUBLISHED' | 'ARCHIVED' | 'DRAFT'> = {
    publish: 'PUBLISHED',
    archive: 'ARCHIVED',
    draft: 'DRAFT',
  }

  await prisma.article.updateMany({
    where: { id: { in: validIds } },
    data: { status: statusMap[action as Exclude<Action, 'delete'>] },
  })

  return NextResponse.json({ updated: validIds.length })
}
