import { prisma } from '@/lib/db'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { isDemoMode } from '@/lib/demo'
import { redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { GenerateTopicButton } from './GenerateTopicButton'
import { ImportFromWebsiteButton } from './ImportFromWebsiteButton'
import { ArticlesTable } from './ArticlesTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'


export default async function ArticlesPage(props: {
  searchParams: Promise<{ status?: string; collection?: string; q?: string; filter?: string }>
}) {
  const [session, searchParams, t, tc] = await Promise.all([auth(), props.searchParams, getTranslations('dashboard'), getTranslations('common')])
  if (!session?.user) redirect('/login')

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect('/login')

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) redirect('/dashboard')

  const demoMode = isDemoMode()

  const aiDraftsFilter = searchParams.filter === 'ai-drafts'
  const aiUpdatesFilter = searchParams.filter === 'ai-updates'

  const where = {
    workspaceId,
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
    prisma.article.count({ where: { workspaceId: workspaceId, aiGenerated: true, status: 'DRAFT' } }),
    prisma.article.count({ where: { workspaceId: workspaceId, aiGenerated: true, status: 'PUBLISHED', NOT: { draftContent: null } } }),
  ])

  const articles = await prisma.article.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { collection: true, author: true },
  })

  const tabs = [
    { label: tc('all'), href: '/dashboard/articles', active: !searchParams.status && !searchParams.filter },
    { label: tc('published'), href: '/dashboard/articles?status=PUBLISHED', active: searchParams.status === 'PUBLISHED' },
    { label: tc('draft'), href: '/dashboard/articles?status=DRAFT', active: searchParams.status === 'DRAFT' },
    { label: tc('archived'), href: '/dashboard/articles?status=ARCHIVED', active: searchParams.status === 'ARCHIVED' },
    ...(aiDraftCount > 0 ? [{ label: t('aiDrafts', { count: aiDraftCount }), href: '/dashboard/articles?filter=ai-drafts', active: aiDraftsFilter }] : []),
    ...(aiUpdateCount > 0 ? [{ label: t('aiUpdates', { count: aiUpdateCount }), href: '/dashboard/articles?filter=ai-updates', active: aiUpdatesFilter }] : []),
  ]

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-semibold text-2xl sm:text-3xl text-foreground">{t('articles')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tc('articles', { count: articles.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <GenerateTopicButton />
          <ImportFromWebsiteButton />
          <Button asChild size="sm" className="shrink-0">
            <Link href="/dashboard/articles/new">
              {t('newArticle')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors',
              tab.active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
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
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-4xl mb-3">📝</p>
            <p className="font-medium text-foreground mb-1">{t('noArticlesYet')}</p>
            <p className="text-muted-foreground text-sm mb-4">
              {t('createFirstArticle')}
            </p>
            <Button variant="link" asChild className="h-auto p-0 text-orange-500">
              <Link href="/dashboard/articles/new">
                {t('createArticle')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ArticlesTable articles={articles} demoMode={demoMode} />
      )}
    </div>
  )
}
