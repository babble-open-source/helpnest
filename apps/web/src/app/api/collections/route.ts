import { Prisma } from '@helpnest/db'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const visibilityParam = searchParams.get('visibility')
  const visibility = visibilityParam === 'PUBLIC' || visibilityParam === 'INTERNAL' ? visibilityParam : undefined
  const isArchived = searchParams.get('isArchived')

  const collections = await prisma.collection.findMany({
    where: {
      workspaceId: authResult.workspaceId,
      ...(visibility ? { visibility } : {}),
      ...(isArchived !== null ? { isArchived: isArchived === 'true' } : { isArchived: false }),
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json({ data: collections, total: collections.length })
}

/** Walk up the parent chain and return the depth of the given collection (1 = root). */
async function getCollectionDepth(id: string): Promise<number> {
  const col = await prisma.collection.findUnique({ where: { id }, select: { parentId: true } })
  if (!col?.parentId) return 1
  return 1 + await getCollectionDepth(col.parentId)
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workspaceId, userId, via } = authResult

  // Session-authenticated users must have at least EDITOR role.
  if (via === 'session' && userId) {
    const member = await prisma.member.findFirst({
      where: {
        userId,
        workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'EDITOR'] },
      },
      select: { id: true },
    })
    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await request.json() as { title?: string; description?: string; emoji?: string; visibility?: string; parentId?: string }
  const { title, description, emoji, parentId } = body
  const visibility = body.visibility === 'INTERNAL' ? 'INTERNAL' as const : 'PUBLIC' as const

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  // Validate parent and depth when creating a sub-collection.
  if (parentId) {
    const parent = await prisma.collection.findFirst({
      where: { id: parentId, workspaceId },
      select: { id: true },
    })
    if (!parent) {
      return NextResponse.json({ error: 'Parent collection not found' }, { status: 404 })
    }
    const parentDepth = await getCollectionDepth(parentId)
    if (parentDepth >= 3) {
      return NextResponse.json({ error: 'Maximum nesting depth of 3 levels reached.' }, { status: 422 })
    }
  }

  const baseSlug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  // Order: append after existing siblings at the same level.
  const count = await prisma.collection.count({
    where: { workspaceId, parentId: parentId ?? null },
  })

  // Retry on unique slug conflict to handle concurrent creates (TOCTOU-safe)
  let slug = baseSlug
  let i = 1
  for (;;) {
    try {
      const collection = await prisma.collection.create({
        data: {
          workspaceId,
          title: title.trim(),
          slug,
          description: description?.trim() || null,
          emoji: emoji || '📁',
          visibility,
          order: count,
          ...(parentId ? { parentId } : {}),
        },
      })
      return NextResponse.json(collection, { status: 201 })
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        slug = `${baseSlug}-${i++}`
      } else {
        throw e
      }
    }
  }
}
