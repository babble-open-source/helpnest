import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArticleContent } from '@/components/help/ArticleContent'
import { ArticleFeedback } from '@/components/help/ArticleFeedback'

interface Props {
  params: { workspace: string; collection: string; article: string }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

function extractHeadings(content: string): { id: string; text: string; level: number }[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm
  const headings: { id: string; text: string; level: number }[] = []
  let match
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1]!.length
    const text = match[2]!.trim()
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    headings.push({ id, text, level })
  }
  return headings
}

function readTime(content: string) {
  return Math.max(1, Math.round(content.split(/\s+/).length / 200))
}

export default async function ArticlePage({ params }: Props) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace },
  })
  if (!workspace) notFound()

  const article = await prisma.article.findUnique({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: params.article } },
    include: {
      author: true,
      collection: true,
    },
  })
  if (!article || article.status !== 'PUBLISHED') notFound()

  // Increment view count (fire and forget)
  prisma.article.update({
    where: { id: article.id },
    data: { views: { increment: 1 } },
  }).catch(() => {})

  // Related articles from same collection
  const related = await prisma.article.findMany({
    where: {
      collectionId: article.collectionId,
      status: 'PUBLISHED',
      id: { not: article.id },
    },
    take: 3,
    orderBy: { views: 'desc' },
  })

  const headings = extractHeadings(article.content)
  const minutes = readTime(article.content)

  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-cream/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2 text-sm">
          <Link href={`/${params.workspace}/help`} className="text-muted hover:text-ink transition-colors">
            {workspace.name}
          </Link>
          <span className="text-border">/</span>
          <Link
            href={`/${params.workspace}/help/${params.collection}`}
            className="text-muted hover:text-ink transition-colors"
          >
            {article.collection.title}
          </Link>
          <span className="text-border">/</span>
          <span className="text-ink font-medium truncate">{article.title}</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex gap-12">
          {/* Main content */}
          <article className="flex-1 min-w-0 max-w-2xl">
            {/* Article header */}
            <header className="mb-8">
              <div className="flex items-center gap-2 text-xs text-muted mb-3">
                <Link
                  href={`/${params.workspace}/help/${params.collection}`}
                  className="bg-cream border border-border rounded-full px-2 py-0.5 hover:border-accent transition-colors"
                >
                  {article.collection.title}
                </Link>
                <span>·</span>
                <span>{minutes} min read</span>
              </div>
              <h1 className="font-serif text-4xl text-ink mb-4 leading-tight">{article.title}</h1>
              <div className="flex items-center gap-3 text-sm text-muted">
                <div className="w-6 h-6 rounded-full bg-border flex items-center justify-center text-xs font-medium text-ink">
                  {article.author.name?.[0] ?? 'A'}
                </div>
                <span>{article.author.name}</span>
                {article.publishedAt && (
                  <>
                    <span>·</span>
                    <span>{formatDate(article.publishedAt)}</span>
                  </>
                )}
              </div>
            </header>

            {/* Article body */}
            <ArticleContent content={article.content} />

            {/* Feedback */}
            <ArticleFeedback articleId={article.id} />

            {/* Related articles */}
            {related.length > 0 && (
              <section className="mt-12 pt-8 border-t border-border">
                <h2 className="font-serif text-xl text-ink mb-4">Related articles</h2>
                <div className="grid gap-3">
                  {related.map((rel) => (
                    <Link
                      key={rel.id}
                      href={`/${params.workspace}/help/${params.collection}/${rel.slug}`}
                      className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:border-accent transition-colors group"
                    >
                      <svg className="w-4 h-4 text-muted group-hover:text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-medium text-ink group-hover:text-accent transition-colors text-sm">
                        {rel.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* CTA */}
            <div className="mt-12 bg-ink rounded-xl p-6 text-cream text-center">
              <p className="font-serif text-xl mb-2">Need more help?</p>
              <p className="text-cream/70 text-sm mb-4">Can&apos;t find what you&apos;re looking for?</p>
              <Link
                href={`/${params.workspace}/help`}
                className="inline-flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors"
              >
                Browse all articles
              </Link>
            </div>
          </article>

          {/* Sidebar TOC */}
          {headings.length > 0 && (
            <aside className="hidden lg:block w-56 shrink-0">
              <div className="sticky top-20">
                <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">On this page</p>
                <nav className="space-y-1">
                  {headings.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className={`block text-sm text-muted hover:text-ink transition-colors py-0.5 ${
                        h.level === 2 ? 'pl-0' : h.level === 3 ? 'pl-3' : 'pl-0'
                      }`}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
