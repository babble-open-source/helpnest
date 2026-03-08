import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ArticleEditor } from '@/components/editor/ArticleEditor'
import { getTheme, themeToCSS } from '@/lib/themes'

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: {
      collection: true,
      workspace: { select: { themeId: true } },
    },
  })
  if (!article) notFound()

  const collections = await prisma.collection.findMany({
    where: { workspaceId: article.workspaceId },
    select: { id: true, title: true, emoji: true },
    orderBy: { order: 'asc' },
  })

  // Build theme CSS vars so the editor content area previews the workspace's
  // selected theme. Applied scoped to .prose-editor, not :root, so the
  // dashboard chrome (sidebar, toolbar, top bar) is unaffected.
  const theme = getTheme(article.workspace.themeId)
  const themeCSS = themeToCSS(theme)
  const themeFontUrls = [theme.fonts.headingUrl, theme.fonts.bodyUrl].filter(Boolean) as string[]

  return (
    <>
      {themeFontUrls.map((url) => (
        <link key={url} rel="stylesheet" href={url} />
      ))}
      <ArticleEditor
        article={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          content: article.content,
          excerpt: article.excerpt ?? '',
          status: article.status,
          collectionId: article.collectionId,
        }}
        collections={collections}
        themeCSS={themeCSS}
      />
    </>
  )
}
