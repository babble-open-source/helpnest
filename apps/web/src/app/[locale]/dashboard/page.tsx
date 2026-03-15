import { Link } from '@/i18n/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

function helpfulRate(helpful: number, notHelpful: number): number | null {
  const total = helpful + notHelpful
  if (total === 0) return null
  return Math.round((helpful / total) * 100)
}

export default async function DashboardPage() {
  const [session, t, tc] = await Promise.all([auth(), getTranslations('dashboard'), getTranslations('common')])
  if (!session?.user) redirect('/login')

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: {
      workspaceId: true,
      workspace: {
        select: { name: true },
      },
    },
  })

  if (!member) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="font-serif text-3xl text-ink mb-2">{t('welcome')}</h1>
        <p className="text-muted">{t('noWorkspace')}</p>
      </div>
    )
  }

  const [articleCount, publishedCount, collections] = await Promise.all([
    prisma.article.count({ where: { workspaceId: member.workspaceId } }),
    prisma.article.count({ where: { workspaceId: member.workspaceId, status: 'PUBLISHED' } }),
    prisma.collection.count({ where: { workspaceId: member.workspaceId } }),
  ])

  const last30Days = new Date()
  last30Days.setDate(last30Days.getDate() - 30)
  const feedbackPrisma = prisma as typeof prisma & {
    articleFeedback: {
      count(args: unknown): Promise<number>
    }
  }

  type RecentArticle = {
    id: string
    title: string
    status: string
    collection: { id: string; title: string; slug: string }
  }
  const recentArticlesPromise: Promise<RecentArticle[]> = prisma.article.findMany({
    where: { workspaceId: member.workspaceId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: { collection: true },
  })
  const feedbackCount30DaysPromise: Promise<number> = feedbackPrisma.articleFeedback.count({
    where: {
      workspaceId: member.workspaceId,
      createdAt: { gte: last30Days },
    },
  })
  const totalFeedbackCountPromise: Promise<number> = feedbackPrisma.articleFeedback.count({
    where: { workspaceId: member.workspaceId },
  })
  const feedbackTotalsPromise = prisma.article.aggregate({
    where: { workspaceId: member.workspaceId },
    _sum: {
      helpful: true,
      notHelpful: true,
    },
  })
  type FeedbackArticle = {
    id: string
    title: string
    slug: string
    helpful: number
    notHelpful: number
    views: number
    collection: { slug: string; title: string }
  }
  const feedbackArticlesPromise: Promise<FeedbackArticle[]> = prisma.article.findMany({
    where: {
      workspaceId: member.workspaceId,
      status: 'PUBLISHED',
      OR: [
        { helpful: { gt: 0 } },
        { notHelpful: { gt: 0 } },
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      helpful: true,
      notHelpful: true,
      views: true,
      collection: {
        select: { slug: true, title: true },
      },
    },
    orderBy: [
      { notHelpful: 'desc' },
      { helpful: 'asc' },
      { views: 'desc' },
    ],
    take: 20,
  })

  const [recentArticles, feedbackCount30Days, totalFeedbackCount, feedbackTotals, feedbackArticles] = await Promise.all([
    recentArticlesPromise,
    feedbackCount30DaysPromise,
    totalFeedbackCountPromise,
    feedbackTotalsPromise,
    feedbackArticlesPromise,
  ])

  // AI conversation metrics
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const [totalConversations, resolvedByAI, escalatedCount, weekConversations, unresolvedGaps, aiNewDraftCount, aiUpdateCount] = await Promise.all([
    prisma.conversation.count({ where: { workspaceId: member.workspaceId } }),
    prisma.conversation.count({ where: { workspaceId: member.workspaceId, status: 'RESOLVED_AI' } }),
    prisma.conversation.count({ where: { workspaceId: member.workspaceId, status: 'ESCALATED' } }),
    prisma.conversation.count({ where: { workspaceId: member.workspaceId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.knowledgeGap.count({ where: { workspaceId: member.workspaceId, resolvedAt: null } }),
    prisma.article.count({ where: { workspaceId: member.workspaceId, aiGenerated: true, status: 'DRAFT' } }),
    prisma.article.count({ where: { workspaceId: member.workspaceId, aiGenerated: true, status: 'PUBLISHED', NOT: { draftContent: null } } }),
  ])
  const aiResolutionRate = totalConversations > 0 ? Math.round((resolvedByAI / totalConversations) * 100) : null
  const escalationRate = totalConversations > 0 ? Math.round((escalatedCount / totalConversations) * 100) : null

  const totalHelpful = feedbackTotals._sum.helpful ?? 0
  const totalNotHelpful = feedbackTotals._sum.notHelpful ?? 0
  const overallHelpfulRate = helpfulRate(totalHelpful, totalNotHelpful)
  const needsAttention = feedbackArticles
    .map((article) => {
      const totalVotes = article.helpful + article.notHelpful
      return {
        ...article,
        totalVotes,
        helpfulRate: helpfulRate(article.helpful, article.notHelpful),
      }
    })
    .filter((article) => article.totalVotes > 0)
    .sort((a, b) => {
      const aRate = a.helpfulRate ?? 100
      const bRate = b.helpfulRate ?? 100
      if (aRate !== bRate) return aRate - bRate
      return b.notHelpful - a.notHelpful
    })
    .slice(0, 5)

  const stats = [
    { label: t('totalArticles'), value: articleCount },
    { label: tc('published'), value: publishedCount },
    { label: t('collections'), value: collections },
    { label: tc('draft'), value: articleCount - publishedCount },
    { label: t('feedbackResponses'), value: totalFeedbackCount },
    { label: t('helpfulRate'), value: overallHelpfulRate === null ? '—' : `${overallHelpfulRate}%` },
    { label: t('negativeVotes'), value: totalNotHelpful },
    { label: t('responses30d'), value: feedbackCount30Days },
  ]

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl text-ink">{t('overview')}</h1>
        <p className="text-muted mt-1">{member.workspace.name}</p>
      </div>

      {/* AI Support Stats */}
      {totalConversations > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {[
            { label: t('conversations'), value: totalConversations },
            { label: t('aiResolutionRate'), value: aiResolutionRate !== null ? `${aiResolutionRate}%` : '—', color: 'text-green' },
            { label: t('escalationRate'), value: escalationRate !== null ? `${escalationRate}%` : '—', color: 'text-accent' },
            { label: t('conversations7d'), value: weekConversations },
            { label: t('knowledgeGaps'), value: unresolvedGaps },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-border p-5">
              <p className={`text-2xl font-semibold ${'color' in s ? s.color : 'text-ink'}`}>{s.value}</p>
              <p className="text-sm text-muted mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* AI Draft Review Cards */}
      {(aiNewDraftCount > 0 || aiUpdateCount > 0) && (
        <div className="flex flex-wrap gap-4 mb-10">
          {aiNewDraftCount > 0 && (
            <Link
              href="/dashboard/articles?filter=ai-drafts"
              className="bg-white rounded-xl border border-border p-5 hover:border-accent transition-colors"
            >
              <p className="text-2xl font-semibold text-ink">{aiNewDraftCount}</p>
              <p className="text-sm text-muted mt-1">{t('aiDraftsToReview')}</p>
            </Link>
          )}
          {aiUpdateCount > 0 && (
            <Link
              href="/dashboard/articles?filter=ai-updates"
              className="bg-white rounded-xl border border-border p-5 hover:border-accent transition-colors"
            >
              <p className="text-2xl font-semibold text-ink">{aiUpdateCount}</p>
              <p className="text-sm text-muted mt-1">{t('aiArticleUpdates')}</p>
            </Link>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-border p-5">
            <p className="text-2xl font-semibold text-ink">{stat.value}</p>
            <p className="text-sm text-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-10">
        <h2 className="font-serif text-xl text-ink mb-4">{t('needsAttention')}</h2>
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {needsAttention.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-muted">
                {t('noFeedbackYet')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {needsAttention.map((article) => (
                <div key={article.id} className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">{article.title}</p>
                    <p className="text-sm text-muted mt-0.5">{article.collection.title}</p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className={`text-sm font-medium ${(article.helpfulRate ?? 0) >= 70 ? 'text-ink' : 'text-accent'}`}>
                      {t('percentHelpful', { rate: article.helpfulRate ?? 0 })}
                    </p>
                    <p className="text-xs text-muted">
                      {t('negativeOfTotal', { negative: article.notHelpful, total: article.totalVotes })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent articles */}
      <div>
        <h2 className="font-serif text-xl text-ink mb-4">{t('recentArticles')}</h2>
        <div className="bg-white rounded-xl border border-border divide-y divide-border">
          {recentArticles.map((article) => (
            <div key={article.id} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink truncate">{article.title}</p>
                <p className="text-sm text-muted mt-0.5">{article.collection.title}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                article.status === 'PUBLISHED'
                  ? 'bg-green/10 text-green'
                  : article.status === 'DRAFT'
                  ? 'bg-cream text-muted border border-border'
                  : 'bg-border text-muted'
              }`}>
                {{ PUBLISHED: tc('published'), DRAFT: tc('draft'), ARCHIVED: tc('archived') }[article.status] ?? article.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
