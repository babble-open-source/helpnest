import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ArticleEditor } from '@/components/editor/ArticleEditor'
import { isHtml, mdToHtml } from '@/lib/content'

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { collection: true },
  })
  if (!article) notFound()

  const collections = await prisma.collection.findMany({
    where: { workspaceId: article.workspaceId },
    select: { id: true, title: true, emoji: true },
    orderBy: { order: 'asc' },
  })

  // Tiptap only understands HTML. Convert legacy Markdown content on the way in.
  // Once the editor saves, it will write back clean HTML — one-time conversion.
  const content = isHtml(article.content) ? article.content : mdToHtml(article.content)

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
      }}
      collections={collections}
    />
  )
}
