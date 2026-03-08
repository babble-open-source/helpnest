import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'

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

  // Generate slug from title
  const baseSlug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  // Ensure uniqueness within the workspace
  const existing = await prisma.collection.findMany({
    where: { workspaceId, slug: { startsWith: baseSlug } },
    select: { slug: true },
  })
  const slug = existing.length === 0 ? baseSlug : `${baseSlug}-${existing.length}`

  // Order: append after existing top-level collections
  const count = await prisma.collection.count({
    where: { workspaceId, parentId: null },
  })

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
}
