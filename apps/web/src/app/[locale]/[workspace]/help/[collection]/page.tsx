import type { Metadata } from 'next'
import { cache } from 'react'
import { getWorkspaceColumnSet, prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { locales } from '@/i18n/config'
import { getHelpBaseUrl } from '@/lib/help-url'
import { getHelpCenterVisibility } from '@/lib/help-visibility'
import type { CollectionVisibility } from '@helpnest/db'

interface Props {
  params: Promise<{ locale: string; workspace: string; collection: string }>
}

const getWorkspace = cache(async (slug: string) => {
  const columns = await getWorkspaceColumnSet()
  const ws = await prisma.workspace.findFirst({
    where: { slug },
    select: {
      id: true,
      name: true,
      logo: true,
      deletedAt: true,
      ...(columns.has('brandText') ? { brandText: true } : {}),
    },
  })
  if (ws?.deletedAt) return null
  return ws
})

const getCollection = cache((workspaceId: string, slug: string, allowedVisibility: CollectionVisibility[]) =>
  prisma.collection.findUnique({
    where: { workspaceId_slug: { workspaceId, slug } },
    include: {
      parent: { select: { id: true, title: true, slug: true, parent: { select: { id: true, title: true, slug: true } } } },
      articles: {
        where: { status: 'PUBLISHED' },
        orderBy: { order: 'asc' },
        include: { author: true },
      },
      subCollections: {
        where: { visibility: { in: allowedVisibility }, isArchived: false },
        include: {
          _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
        },
      },
    },
  })
)

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const t = await getTranslations('help')

  const workspace = await getWorkspace(params.workspace)
  if (!workspace) return {}

  const allowedVisibility = await getHelpCenterVisibility(workspace.id)
  const collection = await getCollection(workspace.id, params.collection, allowedVisibility)
  if (!collection) return {}

  // Don't leak internal collection metadata to unauthenticated users / crawlers
  if (collection.visibility === 'INTERNAL' && !allowedVisibility.includes('INTERNAL')) return {}

  const title = `${collection.title} — ${workspace.name} ${t('helpCenter')}`
  const description = collection.description ?? title

  const baseUrl = await getHelpBaseUrl()
  const canonicalUrl = baseUrl
    ? `${baseUrl}/${params.locale}/${params.collection}`
    : undefined

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: Object.fromEntries(
        locales.map((l) => [
          l,
          baseUrl
            ? `${baseUrl}/${l}/${params.collection}`
            : `/${l}/${params.workspace}/help/${params.collection}`,
        ]),
      ),
    },
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

function readMinutes(content: string): number {
  const words = content.split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

export default async function CollectionPage(props: Props) {
  const params = await props.params
  const [t, tc] = await Promise.all([
    getTranslations('help'),
    getTranslations('common'),
  ])
  const workspace = await getWorkspace(params.workspace)
  if (!workspace) notFound()

  const allowedVisibility = await getHelpCenterVisibility(workspace.id)
  const collection = await getCollection(workspace.id, params.collection, allowedVisibility)

  if (!collection || collection.isArchived) notFound()

  // If collection is INTERNAL and user is not a member, show login prompt
  if (collection.visibility === 'INTERNAL' && !allowedVisibility.includes('INTERNAL')) {
    redirect(`/login?callbackUrl=/${params.workspace}/help/${params.collection}`)
  }

  const showInternalBadge = allowedVisibility.includes('INTERNAL') && collection.visibility === 'INTERNAL'

  return (
    <div className="min-h-screen bg-cream">
      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted mb-6 flex-wrap">
          <Link href={`/${params.workspace}/help`} className="hover:text-ink transition-colors shrink-0">
            {t('helpCenter')}
          </Link>
          {collection.parent?.parent && (
            <>
              <span className="text-border shrink-0">/</span>
              <Link href={`/${params.workspace}/help/${collection.parent.parent.slug}`} className="hover:text-ink transition-colors truncate max-w-[120px] sm:max-w-[200px]">
                {collection.parent.parent.title}
              </Link>
            </>
          )}
          {collection.parent && (
            <>
              <span className="text-border shrink-0">/</span>
              <Link href={`/${params.workspace}/help/${collection.parent.slug}`} className="hover:text-ink transition-colors truncate max-w-[120px] sm:max-w-[200px]">
                {collection.parent.title}
              </Link>
            </>
          )}
          <span className="text-border shrink-0">/</span>
          <span className="text-ink font-medium truncate max-w-[160px] sm:max-w-[240px]">{collection.title}</span>
        </nav>

        {/* Collection header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl shrink-0">{collection.emoji ?? '📄'}</span>
            <h1 className="font-serif text-3xl sm:text-4xl text-ink leading-snug">{collection.title}</h1>
            {showInternalBadge && (
              <span className="inline-flex items-center gap-1 text-xs text-muted bg-cream border border-border rounded-full px-2.5 py-1 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                {t('internal')}
              </span>
            )}
          </div>
          {collection.description && (
            <p className="text-muted text-lg mt-1">{collection.description}</p>
          )}
        </div>

        {/* Sub-collections */}
        {collection.subCollections.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">{t('subcategories')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {collection.subCollections.map((sub: { id: string; slug: string; emoji: string | null; title: string; _count: { articles: number } }) => (
                <Link
                  key={sub.id}
                  href={`/${params.workspace}/help/${sub.slug}`}
                  className="flex items-center gap-4 bg-white border border-border rounded-xl p-4 hover:border-accent/60 hover:shadow-sm transition-all group"
                >
                  <span className="text-2xl shrink-0">{sub.emoji ?? '📂'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink group-hover:text-accent transition-colors truncate">{sub.title}</p>
                    <p className="text-xs text-muted mt-0.5">{tc('articles', { count: sub._count.articles })}</p>
                  </div>
                  <svg className="w-4 h-4 text-muted group-hover:text-accent transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Articles */}
        <section>
          {collection.articles.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <p>{t('noArticles')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border divide-y divide-border">
              {collection.articles.map((article: { id: string; title: string; slug: string; excerpt: string | null; content: string; author: { name: string | null } }) => (
                <Link
                  key={article.id}
                  href={`/${params.workspace}/help/${params.collection}/${article.slug}`}
                  className="flex items-start gap-4 p-5 hover:bg-cream/50 transition-colors group"
                >
                  <div className="mt-0.5 text-muted group-hover:text-accent transition-colors shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink group-hover:text-accent transition-colors">
                      {article.title}
                    </p>
                    {article.excerpt && (
                      <p className="text-sm text-muted mt-1 line-clamp-2">{article.excerpt}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                      {article.author.name && <span>{article.author.name}</span>}
                      <span>{t('minRead', { minutes: readMinutes(article.content) })}</span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-muted group-hover:text-accent transition-colors shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
