import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sinceRaw = searchParams.get('since')
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT

  if (!sinceRaw) {
    return NextResponse.json(
      { error: 'Missing required query parameter: since (ISO 8601 timestamp)' },
      { status: 400 }
    )
  }

  const sinceDate = new Date(sinceRaw)
  if (isNaN(sinceDate.getTime())) {
    return NextResponse.json(
      { error: 'Invalid since parameter — must be a valid ISO 8601 timestamp' },
      { status: 400 }
    )
  }

  const articles = await prisma.article.findMany({
    where: {
      workspaceId: authResult.workspaceId,
      updatedAt: { gt: sinceDate },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      collection: { select: { slug: true } },
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  })

  const changes = articles.map(article => ({
    id: article.id,
    slug: article.slug,
    title: article.title,
    action: deriveAction(article, sinceDate),
    updatedAt: article.updatedAt.toISOString(),
    collectionSlug: article.collection.slug,
  }))

  // cursor is the updatedAt of the last entry — callers pass this as `since`
  // on the next request to fetch the next page of changes.
  const cursor = changes.length > 0 ? changes[changes.length - 1]!.updatedAt : null

  return NextResponse.json({ changes, cursor })
}

type ActionInput = {
  status: string
  createdAt: Date
  updatedAt: Date
  publishedAt: Date | null
}

function deriveAction(
  article: ActionInput,
  since: Date
): 'created' | 'updated' | 'published' | 'archived' {
  if (article.status === 'ARCHIVED') return 'archived'

  // createdAt and updatedAt are equal (within 1 second) on a freshly created article.
  // Using a 1-second tolerance handles sub-millisecond DB rounding.
  const ageDiffMs = Math.abs(article.updatedAt.getTime() - article.createdAt.getTime())
  if (ageDiffMs < 1000) return 'created'

  // publishedAt was set (or reset) after the caller's since timestamp
  if (article.publishedAt && article.publishedAt > since) return 'published'

  return 'updated'
}
