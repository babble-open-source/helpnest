import { NextResponse } from 'next/server'
import { Prisma } from '@helpnest/db'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
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
    where: { workspaceId },
    select: { id: true },
  })
  if (!collection) return NextResponse.json({ error: 'Create a collection first' }, { status: 400 })

  const title = 'Untitled article'
  const baseSlug = slugify(title)

  // Retry on unique slug conflict to handle concurrent creates (TOCTOU-safe)
  let slug = baseSlug
  let i = 1
  while (true) {
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
