import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getTranslations } from 'next-intl/server'
function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 200)
}

export default async function NewArticlePage() {
  const [session, t] = await Promise.all([auth(), getTranslations('editor')])
  if (!session?.user) redirect('/login')

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect('/login')

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) redirect('/dashboard')

  const collection = await prisma.collection.findFirst({
    where: { workspaceId, isArchived: false },
    orderBy: { order: 'asc' },
    select: { id: true },
  })
  if (!collection) redirect('/dashboard/collections')

  const title = t('untitledArticle')
  let slug = slugify(title)
  let i = 1
  while (await prisma.article.findUnique({
    where: { workspaceId_slug: { workspaceId, slug } }
  })) {
    slug = `${slugify(title)}-${i++}`
  }

  const article = await prisma.article.create({
    data: {
      workspaceId,
      collectionId: collection.id,
      authorId: userId,
      title,
      slug,
      content: '',
      status: 'DRAFT',
    },
  })

  redirect(`/dashboard/articles/${article.id}/edit`)
}
