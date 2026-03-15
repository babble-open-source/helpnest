import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'
import { htmlToMarkdown } from '@/lib/html-to-markdown'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')

  const rawPage = parseInt(searchParams.get('page') ?? String(DEFAULT_PAGE), 10)
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT

  const { workspaceId } = authResult

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, slug: true },
  })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  // Fetch all published articles for the workspace, ordered deterministically
  // for stable pagination. We join collection in a single query to avoid N+1.
  const articles = await prisma.article.findMany({
    where: {
      workspaceId,
      status: 'PUBLISHED',
    },
    select: {
      title: true,
      slug: true,
      content: true,
      updatedAt: true,
      collection: {
        select: { title: true, slug: true },
      },
    },
    orderBy: [{ collection: { slug: 'asc' } }, { slug: 'asc' }],
    skip: (page - 1) * limit,
    take: limit,
  })

  // Group articles by collection
  const collectionMap = new Map<string, {
    title: string
    slug: string
    articles: { title: string; slug: string; content: string; updatedAt: string }[]
  }>()

  for (const article of articles) {
    const colSlug = article.collection.slug
    if (!collectionMap.has(colSlug)) {
      collectionMap.set(colSlug, {
        title: article.collection.title,
        slug: colSlug,
        articles: [],
      })
    }
    const content = format === 'markdown'
      ? htmlToMarkdown(article.content ?? '')
      : (article.content ?? '')

    collectionMap.get(colSlug)!.articles.push({
      title: article.title,
      slug: article.slug,
      content,
      updatedAt: article.updatedAt.toISOString(),
    })
  }

  return NextResponse.json({
    workspace: workspace.slug,
    exportedAt: new Date().toISOString(),
    collections: Array.from(collectionMap.values()),
  })
}
