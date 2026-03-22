import { NextResponse } from 'next/server'
import { Prisma } from '@helpnest/db'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'
import { htmlToMarkdown } from '@/lib/html-to-markdown'
import { checkLimit, incrementUsage } from '@/lib/cloud'
import { slugify } from '@/lib/slugify'

const VALID_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
type ArticleStatus = typeof VALID_STATUSES[number]

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')?.toUpperCase()
  const collectionId = searchParams.get('collection')
  const q = searchParams.get('q')
  const format = searchParams.get('format')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
  const skip = (page - 1) * limit

  if (status && !VALID_STATUSES.includes(status as ArticleStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const where = {
    workspaceId: authResult.workspaceId,
    ...(status ? { status: status as ArticleStatus } : {}),
    ...(collectionId ? { collectionId } : {}),
    ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
  }

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        status: true,
        views: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        // Include raw content only when the caller requests a format transform,
        // to avoid bloating list responses for normal dashboard usage.
        ...(format === 'markdown' ? { content: true } : {}),
        collection: { select: { id: true, title: true, slug: true } },
        author: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.article.count({ where }),
  ])

  const data = format === 'markdown'
    ? articles.map(a => ({
        ...a,
        content: htmlToMarkdown((a as typeof a & { content: string }).content ?? ''),
      }))
    : articles

  return NextResponse.json({ data, total, page, limit })
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspaceId, userId } = authResult

  let authorId = userId
  if (!authorId) {
    const member = await prisma.member.findFirst({
      where: { workspaceId },
      select: { userId: true },
      orderBy: { id: 'asc' },
    })
    if (!member) return NextResponse.json({ error: 'No workspace member found' }, { status: 500 })
    authorId = member.userId
  }

  const body = await request.json() as {
    title?: string
    content?: string
    excerpt?: string
    collectionId?: string
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  }

  const title = body.title?.trim() || 'Untitled article'

  // Resolve collection: use provided collectionId or fall back to first collection
  let collectionId = body.collectionId
  if (!collectionId) {
    const defaultCollection = await prisma.collection.findFirst({
      where: { workspaceId, isArchived: false },
      orderBy: { order: 'asc' },
      select: { id: true },
    })
    if (!defaultCollection) return NextResponse.json({ error: 'Create a collection first' }, { status: 400 })
    collectionId = defaultCollection.id
  } else {
    const col = await prisma.collection.findFirst({
      where: { id: collectionId, workspaceId },
      select: { id: true },
    })
    if (!col) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
  }

  // Check plan limit before creating
  const limit = await checkLimit(workspaceId, 'articles')
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Article limit reached. Upgrade your plan.' },
      { status: 403 },
    )
  }

  const status = body.status ?? 'DRAFT'
  const baseSlug = slugify(title)

  let slug = baseSlug
  let i = 1
  for (;;) {
    try {
      const article = await prisma.article.create({
        data: {
          workspaceId,
          collectionId,
          authorId,
          title,
          slug,
          content: body.content ?? '',
          excerpt: body.excerpt ?? null,
          status,
          ...(status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
        },
      })
      incrementUsage(workspaceId, 'articles')
      return NextResponse.json(article, { status: 201 })
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        slug = `${baseSlug}-${i++}`
      } else {
        throw e
      }
    }
  }
}
