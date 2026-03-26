import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getTranslations } from 'next-intl/server'
import { slugify } from '@/lib/slugify'

export default async function NewArticlePage(props: {
  searchParams: Promise<{ collection?: string }>
}) {
  const [session, searchParams, t] = await Promise.all([auth(), props.searchParams, getTranslations('editor')])
  if (!session?.user) redirect('/login')

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect('/login')

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) redirect('/dashboard')

  // Use the ?collection= param if provided and valid, otherwise fall back to the first collection.
  let collection = searchParams.collection
    ? await prisma.collection.findFirst({
        where: { id: searchParams.collection, workspaceId, isArchived: false },
        select: { id: true },
      })
    : null

  if (!collection) {
    collection = await prisma.collection.findFirst({
      where: { workspaceId, isArchived: false },
      orderBy: { order: 'asc' },
      select: { id: true },
    })
  }

  if (!collection) redirect('/dashboard/collections')

  const title = t('untitled')
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

  const pickCollection = !searchParams.collection
  redirect(`/dashboard/articles/${article.id}/edit${pickCollection ? '?pickCollection=true' : ''}`)
}
