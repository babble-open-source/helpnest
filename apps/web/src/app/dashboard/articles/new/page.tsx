import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80)
}

export default async function NewArticlePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspaceId: true, userId: true },
  })
  if (!member) redirect('/dashboard')

  const collection = await prisma.collection.findFirst({
    where: { workspaceId: member.workspaceId, isArchived: false },
    orderBy: { order: 'asc' },
    select: { id: true },
  })
  if (!collection) redirect('/dashboard/collections')

  const title = 'Untitled article'
  let slug = slugify(title)
  let i = 1
  while (await prisma.article.findUnique({
    where: { workspaceId_slug: { workspaceId: member.workspaceId, slug } }
  })) {
    slug = `${slugify(title)}-${i++}`
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

  redirect(`/dashboard/articles/${article.id}/edit`)
}
