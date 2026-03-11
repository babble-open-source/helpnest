import { NextResponse } from 'next/server'
import { Prisma } from '@helpnest/db'
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

  return NextResponse.json({ articles, total: articles.length })
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspaceId, userId } = authResult

  // For session auth, userId comes from the member lookup in requireAuth.
  // For API key auth, we need to find any user in the workspace to assign as author.
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

  // Get first collection as default
  const collection = await prisma.collection.findFirst({
    where: { workspaceId, isArchived: false },
    orderBy: { order: 'asc' },
    select: { id: true },
  })
  if (!collection) return NextResponse.json({ error: 'Create a collection first' }, { status: 400 })

  const title = 'Untitled article'
  const baseSlug = slugify(title)

  // Retry on unique slug conflict to handle concurrent creates (TOCTOU-safe)
  let slug = baseSlug
  let i = 1
  for (;;) {
    try {
      const article = await prisma.article.create({
        data: {
          workspaceId,
          collectionId: collection.id,
          authorId,
          title,
          slug,
          content: '',
          status: 'DRAFT',
        },
      })
      return NextResponse.json({ id: article.id })
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        slug = `${baseSlug}-${i++}`
      } else {
        throw e
      }
    }
  }
}
