import { Prisma } from '@helpnest/db'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const isPublic = searchParams.get('isPublic')
  const isArchived = searchParams.get('isArchived')

  const collections = await prisma.collection.findMany({
    where: {
      workspaceId: authResult.workspaceId,
      ...(isPublic !== null ? { isPublic: isPublic === 'true' } : {}),
      ...(isArchived !== null ? { isArchived: isArchived === 'true' } : { isArchived: false }),
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json({ data: collections, total: collections.length })
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

  const body = await request.json() as { title?: string; description?: string; emoji?: string }
  const { title, description, emoji } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const baseSlug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  // Order: append after existing top-level collections
  const count = await prisma.collection.count({
    where: { workspaceId, parentId: null },
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
          isPublic: true,
          order: count,
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
