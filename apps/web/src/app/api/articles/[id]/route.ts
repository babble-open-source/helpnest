import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { collection: true, author: true },
  })
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(article)
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspaceId: true, userId: true },
  })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
      where: { workspaceId: member.workspaceId, slug, id: { not: params.id } }
    })) {
      slug = `${base}-${i++}`
    }
  }

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
