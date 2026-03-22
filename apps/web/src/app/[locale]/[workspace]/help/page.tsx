import { hasWorkspaceBrandTextColumn, prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { SearchTrigger } from '@/components/help/SearchTrigger'
import { AskAI } from '@/components/help/AskAI'
import { WorkspaceBrandLink } from '@/components/help/WorkspaceBrandLink'
import { DashboardButton } from '@/components/help/DashboardButton'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

interface Props {
  params: Promise<{ workspace: string }>
}

function readMinutes(content: string): number {
  const words = content.split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

export default async function HelpCenterHome(props: Props) {
  const params = await props.params
  const [t, tc] = await Promise.all([
    getTranslations('help'),
    getTranslations('common'),
  ])
  const brandTextColumnExists = await hasWorkspaceBrandTextColumn()
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace, deletedAt: null },
    select: {
      id: true,
      name: true,
      logo: true,
      collections: {
        where: { isPublic: true, isArchived: false, parentId: null },
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
        },
      },
      articles: {
        where: {
          status: 'PUBLISHED',
          collection: { is: { isPublic: true, isArchived: false } },
        },
        orderBy: { views: 'desc' },
        take: 5,
        include: { collection: true },
      },
    },
  })

  if (!workspace) notFound()

  const brandTextRecord = brandTextColumnExists
    ? await prisma.workspace.findUnique({
        where: { id: workspace.id },
        select: { brandText: true },
      })
    : null

  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-cream/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <WorkspaceBrandLink
            href={`/${params.workspace}/help`}
            name={workspace.name}
            logo={workspace.logo}
            brandText={brandTextRecord?.brandText ?? null}
            hideNameWhenLogo
            textClassName="font-serif text-xl text-ink"
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted hidden sm:block">{t('helpCenter')}</span>
            <LanguageSwitcher />
            <DashboardButton />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-ink text-cream py-10 sm:py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-4">{t('heroTitle')}</h1>
          <p className="text-cream/70 text-lg mb-8">
            {t('heroSubtitle')}
          </p>
          <SearchTrigger workspace={params.workspace} />
        </div>
      </section>

      {/* AI Banner */}
      <div className="bg-green text-white py-3 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-3 text-sm">
          <span>{t('aiPowered')}</span>
          <AskAI workspace={params.workspace} />
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-12">
        {/* Collections */}
        <section className="mb-16">
          <h2 className="font-serif text-2xl text-ink mb-6">{t('browseByTopic')}</h2>
          {workspace.collections.length === 0 ? (
            <p className="text-muted">{t('noCollections')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspace.collections.map((col: { id: string; slug: string; emoji: string | null; title: string; description: string | null; _count: { articles: number } }) => (
                <Link
                  key={col.id}
                  href={`/${params.workspace}/help/${col.slug}`}
                  className="group bg-white rounded-xl border border-border p-5 hover:border-accent hover:shadow-sm transition-all"
                >
                  <div className="text-2xl mb-3">{col.emoji ?? '📄'}</div>
                  <h3 className="font-sans font-medium text-[0.9375rem] text-ink group-hover:text-accent transition-colors mb-1">
                    {col.title}
                  </h3>
                  {col.description && (
                    <p className="text-sm text-muted line-clamp-2 mb-3">{col.description}</p>
                  )}
                  <span className="text-xs text-muted">
                    {tc('articles', { count: col._count.articles })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Popular articles */}
        {workspace.articles.length > 0 && (
          <section className="mb-16">
            <h2 className="font-serif text-2xl text-ink mb-6">{t('popularArticles')}</h2>
            <div className="bg-white rounded-xl border border-border divide-y divide-border">
              {workspace.articles.map((article: { id: string; slug: string; title: string; excerpt: string | null; content: string; collection: { slug: string; title: string } }) => (
                <Link
                  key={article.id}
                  href={`/${params.workspace}/help/${article.collection.slug}/${article.slug}`}
                  className="flex items-start gap-4 p-4 hover:bg-cream/50 transition-colors group"
                >
                  <div className="mt-0.5 text-muted group-hover:text-accent transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink group-hover:text-accent transition-colors truncate">
                      {article.title}
                    </p>
                    {article.excerpt && (
                      <p className="text-sm text-muted mt-0.5 line-clamp-1">{article.excerpt}</p>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center gap-3 text-xs text-muted whitespace-nowrap">
                    <span className="bg-cream rounded-full px-2 py-0.5">{article.collection.title}</span>
                    <span>{t('minRead', { minutes: readMinutes(article.content) })}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Footer stats */}
        <footer className="border-t border-border pt-8 text-center">
          <p className="text-muted text-sm mb-4">{t('stillNeedHelp')}</p>
          <div className="flex items-center justify-center gap-8 text-sm text-muted">
            <span>
              {t('articlesCount', { count: workspace.articles.length })}
            </span>
            <span>
              {t('collectionsCount', { count: workspace.collections.length })}
            </span>
          </div>
        </footer>
      </main>
    </div>
  )
}
