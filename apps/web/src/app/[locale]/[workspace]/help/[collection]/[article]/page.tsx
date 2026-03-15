import type { Metadata } from 'next'
import { hasWorkspaceBrandTextColumn, prisma } from '@/lib/db'
import { incrementArticleViews } from '@/lib/counters'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations, getFormatter } from 'next-intl/server'
import { ArticleContent } from '@/components/help/ArticleContent'
import { ArticleFeedback } from '@/components/help/ArticleFeedback'
import { WorkspaceBrandLink } from '@/components/help/WorkspaceBrandLink'
import { DashboardButton } from '@/components/help/DashboardButton'
import { locales } from '@/i18n/config'

interface Props {
  params: Promise<{ locale: string; workspace: string; collection: string; article: string }>
}


function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function extractHeadings(content: string): { id: string; text: string; level: number }[] {
  const headings: { id: string; text: string; level: number }[] = []

  if (content.trimStart().startsWith('<')) {
    // Tiptap HTML — match <h1>, <h2>, <h3> tags, strip any inner markup for the label
    const headingRegex = /<h([1-3])[^>]*>([\s\S]*?)<\/h[1-3]>/gi
    let match
    while ((match = headingRegex.exec(content)) !== null) {
      const level = parseInt(match[1]!, 10)
      const text = match[2]!.replace(/<[^>]+>/g, '').trim()
      if (text) headings.push({ id: slugify(text), text, level })
    }
  } else {
    // Markdown
    const headingRegex = /^(#{1,3})\s+(.+)$/gm
    let match
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1]!.length
      const text = match[2]!.trim()
      headings.push({ id: slugify(text), text, level })
    }
  }

  return headings
}

function readTime(content: string): number {
  const text = content.trimStart().startsWith('<')
    ? content.replace(/<[^>]+>/g, ' ')
    : content
  return Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200))
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const t = await getTranslations('help')

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace },
    select: { id: true, name: true },
  })
  if (!workspace) return {}

  const article = await prisma.article.findUnique({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: params.article } },
    select: { title: true, excerpt: true, updatedAt: true },
  })
  if (!article) return {}

  const title = `${article.title} — ${workspace.name} ${t('helpCenter')}`
  const description = article.excerpt ?? title

  return {
    title,
    description,
    alternates: {
      languages: Object.fromEntries(
        locales.map((l) => [
          l,
          `/${l}/${params.workspace}/help/${params.collection}/${params.article}`,
        ]),
      ),
    },
    openGraph: {
      title,
      description,
      type: 'article',
      modifiedTime: article.updatedAt.toISOString(),
    },
  }
}

export default async function ArticlePage(props: Props) {
  const params = await props.params
  const t = await getTranslations('help')
  const format = await getFormatter()
  const brandTextColumnExists = await hasWorkspaceBrandTextColumn()
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace },
    select: { id: true, name: true, logo: true },
  })
  if (!workspace) notFound()

  const brandTextRecord = brandTextColumnExists
    ? await prisma.workspace.findUnique({
        where: { id: workspace.id },
        select: { brandText: true },
      })
    : null

  const article = await prisma.article.findUnique({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: params.article } },
    include: {
      author: true,
      collection: true,
    },
  })
  if (!article || article.status !== 'PUBLISHED' || !article.collection.isPublic || article.collection.isArchived) notFound()

  // Increment view count — buffered in Redis, flushed to DB at threshold (fire and forget)
  incrementArticleViews(article.id).catch(() => {})

  // Related articles from same collection
  const related = await prisma.article.findMany({
    where: {
      collectionId: article.collectionId,
      status: 'PUBLISHED',
      collection: { is: { isPublic: true, isArchived: false } },
      id: { not: article.id },
    },
    select: { id: true, title: true, slug: true },
    take: 3,
    orderBy: { views: 'desc' },
  })

  const headings = extractHeadings(article.content)
  const minutes = readTime(article.content)

  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-cream/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <WorkspaceBrandLink
              href={`/${params.workspace}/help`}
              name={workspace.name}
              logo={workspace.logo}
              brandText={brandTextRecord?.brandText ?? null}
              hideNameWhenLogo
              className="shrink-0"
              textClassName="text-muted hover:text-ink transition-colors"
            />
            <span className="text-border">/</span>
            <Link
              href={`/${params.workspace}/help/${params.collection}`}
              className="text-muted hover:text-ink transition-colors shrink-0"
            >
              {article.collection.title}
            </Link>
            <span className="text-border">/</span>
            <span className="text-ink font-medium truncate">{article.title}</span>
          </div>
          <DashboardButton />
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-12">
        <div className="flex gap-8 lg:gap-12">
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
                <span>{t('minRead', { minutes })}</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl text-ink mb-4 leading-tight">{article.title}</h1>
              <div className="flex items-center gap-3 text-sm text-muted">
                <div className="w-6 h-6 rounded-full bg-border flex items-center justify-center text-xs font-medium text-ink">
                  {article.author.name?.[0] ?? 'A'}
                </div>
                <span>{article.author.name}</span>
                {article.publishedAt && (
                  <>
                    <span>·</span>
                    <span>{format.dateTime(article.publishedAt, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
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
                <h2 className="font-serif text-xl text-ink mb-4">{t('relatedArticles')}</h2>
                <div className="grid gap-3">
                  {related.map((rel: { id: string; title: string; slug: string }) => (
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
              <p className="font-serif text-xl mb-2">{t('needMoreHelp')}</p>
              <p className="text-cream/70 text-sm mb-4">{t('cantFindLooking')}</p>
              <Link
                href={`/${params.workspace}/help`}
                className="inline-flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors"
              >
                {t('browseAllArticles')}
              </Link>
            </div>
          </article>

          {/* Sidebar TOC */}
          {headings.length > 0 && (
            <aside className="hidden lg:block w-56 shrink-0">
              <div className="sticky top-20">
                <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">{t('onThisPage')}</p>
                <nav className="space-y-1">
                  {headings.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className={`block text-sm text-muted hover:text-ink transition-colors py-0.5 ${
                        h.level === 2 ? 'ps-0' : h.level === 3 ? 'ps-3' : 'ps-0'
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
