import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ArticleEditor } from '@/components/editor/ArticleEditor'
import { isHtml, mdToHtml } from '@/lib/content'

export default async function EditArticlePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { collection: true },
  })
  if (!article) notFound()

  const collections = await prisma.collection.findMany({
    where: {
      workspaceId: article.workspaceId,
      OR: [
        { isArchived: false },
        { id: article.collectionId },
      ],
    },
    select: { id: true, title: true, emoji: true, isArchived: true },
    orderBy: [
      { isArchived: 'asc' },
      { order: 'asc' },
    ],
  })

  // Load draftContent if present (unsaved edits on a published article),
  // otherwise fall back to the live content. Convert Markdown on the way in.
  const raw = article.draftContent ?? article.content
  const content = isHtml(raw) ? raw : mdToHtml(raw)
  const hasDraft = article.status === 'PUBLISHED' && !!article.draftContent

  return (
    <ArticleEditor
      article={{
        id: article.id,
        title: article.title,
        slug: article.slug,
        content,
        excerpt: article.excerpt ?? '',
        status: article.status,
        collectionId: article.collectionId,
        hasDraft,
      }}
      collections={collections}
    />
  )
}
