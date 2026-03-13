import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

const VALID_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
type ArticleStatus = typeof VALID_STATUSES[number]

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')?.toUpperCase()
  const collectionId = searchParams.get('collection')
  const q = searchParams.get('q')

  if (status && !VALID_STATUSES.includes(status as ArticleStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const articles = await prisma.article.findMany({
    where: {
      workspaceId: authResult.workspaceId,
      ...(status ? { status: status as ArticleStatus } : {}),
      ...(collectionId ? { collectionId } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    },
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
      collection: { select: { id: true, title: true, slug: true } },
      author: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ data: articles, total: articles.length })
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
