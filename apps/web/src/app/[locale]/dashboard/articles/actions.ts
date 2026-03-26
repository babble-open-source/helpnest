'use server'

import { redirect } from 'next/navigation'
import { Prisma } from '@helpnest/db'
import { prisma } from '@/lib/db'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { getTranslations } from 'next-intl/server'
import { slugify } from '@/lib/slugify'

export async function createArticle(formData: FormData) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect('/login')

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) redirect('/dashboard')

  const t = await getTranslations('editor')
  const collectionId = formData.get('collectionId') as string | null

  // Use the provided collection if valid, otherwise fall back to first collection.
  let collection = collectionId
    ? await prisma.collection.findFirst({
        where: { id: collectionId, workspaceId, isArchived: false },
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
  const baseSlug = slugify(title)

  // Retry on unique slug conflict to handle concurrent creates (TOCTOU-safe)
  let slug = baseSlug
  let i = 1
  let article: { id: string } | undefined
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      article = await prisma.article.create({
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
      break
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        slug = `${baseSlug}-${i++}`
      } else {
        throw e
      }
    }
  }

  if (!article) {
    throw new Error('Failed to create article after multiple attempts due to slug conflicts')
  }

  redirect(`/dashboard/articles/${article.id}/edit`)
}
