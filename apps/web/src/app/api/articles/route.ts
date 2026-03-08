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

export async function POST(_request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspaceId: true, userId: true },
  })
  if (!member) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  // Get first collection as default
  const collection = await prisma.collection.findFirst({
    where: { workspaceId: member.workspaceId },
    select: { id: true },
  })
  if (!collection) return NextResponse.json({ error: 'Create a collection first' }, { status: 400 })

  const title = 'Untitled article'
  const baseSlug = slugify(title)

  // Ensure unique slug
  let slug = baseSlug
  let i = 1
  while (await prisma.article.findUnique({ where: { workspaceId_slug: { workspaceId: member.workspaceId, slug } } })) {
    slug = `${baseSlug}-${i++}`
  }

  const article = await prisma.article.create({
    data: {
      workspaceId: member.workspaceId,
      collectionId: collection.id,
      authorId: member.userId,
      title,
      slug,
      content: '',
      status: 'DRAFT',
    },
  })

  return NextResponse.json({ id: article.id })
}
