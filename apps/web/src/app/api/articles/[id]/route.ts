import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(request)
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const article = await prisma.article.findFirst({
    where: { id: params.id, workspaceId: authResult.workspaceId },
    include: { collection: true, author: true },
  })
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(article)
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(request)
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspaceId } = authResult

  const body = await request.json() as {
    title?: string
    content?: string
    excerpt?: string
    collectionId?: string
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
    slug?: string
  }

  // Auto-generate slug from title if title changed and no explicit slug
  let slug = body.slug
  if (body.title && !body.slug) {
    slug = slugify(body.title)
    // Ensure unique (exclude self)
    let i = 1
    const base = slug
    while (await prisma.article.findFirst({
      where: { workspaceId, slug, id: { not: params.id } }
    })) {
      slug = `${base}-${i++}`
    }
  }

  // Verify article belongs to the authenticated workspace
  const existing = await prisma.article.findFirst({
    where: { id: params.id, workspaceId },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = body.title
  if (body.content !== undefined) data.content = body.content
  if (body.excerpt !== undefined) data.excerpt = body.excerpt
  if (body.collectionId !== undefined) data.collectionId = body.collectionId
  if (body.status !== undefined) {
    data.status = body.status
    if (body.status === 'PUBLISHED') data.publishedAt = new Date()
  }
  if (slug !== undefined) data.slug = slug

  const article = await prisma.article.update({
    where: { id: params.id },
    data,
  })

  return NextResponse.json(article)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(request)
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // For session-based auth, role enforcement is done by requireAuth indirectly via
  // getMember — but requireAuth only checks membership, not role. For delete, we
  // additionally verify the session-path user has at least EDITOR role.
  if (authResult.via === 'session' && authResult.userId) {
    const member = await prisma.member.findFirst({
      where: {
        userId: authResult.userId,
        workspaceId: authResult.workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'EDITOR'] },
      },
      select: { id: true },
    })
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const article = await prisma.article.findFirst({
    where: { id: params.id, workspaceId: authResult.workspaceId },
    select: { id: true },
  })
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.articleVersion.deleteMany({ where: { articleId: params.id } })
  await prisma.article.delete({ where: { id: params.id } })

  return new NextResponse(null, { status: 204 })
}
