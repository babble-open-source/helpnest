import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isDemoMode } from '@/lib/demo'
import { redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { GenerateTopicButton } from './GenerateTopicButton'
import { ArticlesTable } from './ArticlesTable'
import { SearchInput } from '@/components/ui/SearchInput'


export default async function ArticlesPage(props: {
  searchParams: Promise<{ status?: string; collection?: string; q?: string; filter?: string }>
}) {
  const [session, searchParams, t, tc] = await Promise.all([auth(), props.searchParams, getTranslations('dashboard'), getTranslations('common')])
  if (!session?.user) redirect('/login')

  const demoMode = isDemoMode()

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspaceId: true },
  })
  if (!member) redirect('/dashboard')

  const aiDraftsFilter = searchParams.filter === 'ai-drafts'
  const aiUpdatesFilter = searchParams.filter === 'ai-updates'

  const where = {
    workspaceId: member.workspaceId,
    ...(aiDraftsFilter
      ? { aiGenerated: true, status: 'DRAFT' as const }
      : aiUpdatesFilter
        ? { aiGenerated: true, status: 'PUBLISHED' as const, NOT: { draftContent: null } }
        : searchParams.status
          ? { status: searchParams.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }
          : {}),
    ...(searchParams.collection ? { collectionId: searchParams.collection } : {}),
    ...(searchParams.q
      ? {
          OR: [
            { title: { contains: searchParams.q, mode: 'insensitive' as const } },
            { collection: { title: { contains: searchParams.q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  // Counts for tab badges — only fetch if no active AI filter to avoid redundant queries
  const [aiDraftCount, aiUpdateCount] = await Promise.all([
    prisma.article.count({ where: { workspaceId: member.workspaceId, aiGenerated: true, status: 'DRAFT' } }),
    prisma.article.count({ where: { workspaceId: member.workspaceId, aiGenerated: true, status: 'PUBLISHED', NOT: { draftContent: null } } }),
  ])

  const articles = await prisma.article.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { collection: true, author: true },
  })

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink">{t('articles')}</h1>
          <p className="text-muted text-sm mt-1">
            {tc('articles', { count: articles.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <GenerateTopicButton />
          <Link
            href="/dashboard/articles/new"
            className="bg-ink text-cream px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium shrink-0"
          >
            {t('newArticle')}
          </Link>
        </div>
      </div>

      {/* Status tabs including AI filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[
          { label: tc('all'), href: '/dashboard/articles', active: !searchParams.status && !searchParams.filter },
          { label: tc('published'), href: '/dashboard/articles?status=PUBLISHED', active: searchParams.status === 'PUBLISHED' },
          { label: tc('draft'), href: '/dashboard/articles?status=DRAFT', active: searchParams.status === 'DRAFT' },
          { label: tc('archived'), href: '/dashboard/articles?status=ARCHIVED', active: searchParams.status === 'ARCHIVED' },
          ...(aiDraftCount > 0 ? [{ label: t('aiDrafts', { count: aiDraftCount }), href: '/dashboard/articles?filter=ai-drafts', active: aiDraftsFilter }] : []),
          ...(aiUpdateCount > 0 ? [{ label: t('aiUpdates', { count: aiUpdateCount }), href: '/dashboard/articles?filter=ai-updates', active: aiUpdatesFilter }] : []),
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              tab.active ? 'bg-ink text-cream' : 'text-muted hover:text-ink hover:bg-cream'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SearchInput placeholder={t('searchArticles')} />
      </div>

      {/* Table */}
      {articles.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="font-medium text-ink mb-1">{t('noArticlesYet')}</p>
          <p className="text-muted text-sm mb-4">
            {t('createFirstArticle')}
          </p>
          <Link
            href="/dashboard/articles/new"
            className="text-accent hover:underline text-sm"
          >
            {t('createArticle')}
          </Link>
        </div>
      ) : (
        <ArticlesTable articles={articles} demoMode={demoMode} />
      )}
    </div>
  )
}
