import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

function helpfulRate(helpful: number, notHelpful: number): number | null {
  const total = helpful + notHelpful
  if (total === 0) return null
  return Math.round((helpful / total) * 100)
}

export default async function DashboardPage() {
  const session = await auth()
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
        <h1 className="font-serif text-3xl text-ink mb-2">Welcome to HelpNest</h1>
        <p className="text-muted">You are not a member of any workspace yet.</p>
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

  const recentArticlesPromise = prisma.article.findMany({
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
  const feedbackArticlesPromise = prisma.article.findMany({
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
  const [totalConversations, resolvedByAI, escalatedCount, weekConversations, unresolvedGaps, aiNewDraftCount, aiUpdateCount] = await Promise.all([
    prisma.conversation.count({ where: { workspaceId: member.workspaceId } }),
    prisma.conversation.count({ where: { workspaceId: member.workspaceId, status: 'RESOLVED_AI' } }),
    prisma.conversation.count({ where: { workspaceId: member.workspaceId, status: 'ESCALATED' } }),
    prisma.conversation.count({ where: { workspaceId: member.workspaceId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
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
    { label: 'Total Articles', value: articleCount },
    { label: 'Published', value: publishedCount },
    { label: 'Collections', value: collections },
    { label: 'Draft', value: articleCount - publishedCount },
    { label: 'Feedback Responses', value: totalFeedbackCount },
    { label: 'Helpful Rate', value: overallHelpfulRate === null ? '—' : `${overallHelpfulRate}%` },
    { label: 'Negative Votes', value: totalNotHelpful },
    { label: 'Responses (30d)', value: feedbackCount30Days },
  ]

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl text-ink">Overview</h1>
        <p className="text-muted mt-1">{member.workspace.name}</p>
      </div>

      {/* AI Support Stats */}
      {totalConversations > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {[
            { label: 'Conversations', value: totalConversations },
            { label: 'AI Resolution Rate', value: aiResolutionRate !== null ? `${aiResolutionRate}%` : '—', color: 'text-green' },
            { label: 'Escalation Rate', value: escalationRate !== null ? `${escalationRate}%` : '—', color: 'text-accent' },
            { label: 'Conversations (7d)', value: weekConversations },
            { label: 'Knowledge Gaps', value: unresolvedGaps },
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
            <a
              href="/dashboard/articles?filter=ai-drafts"
              className="bg-white rounded-xl border border-border p-5 hover:border-accent transition-colors"
            >
              <p className="text-2xl font-semibold text-ink">{aiNewDraftCount}</p>
              <p className="text-sm text-muted mt-1">AI Drafts to Review</p>
            </a>
          )}
          {aiUpdateCount > 0 && (
            <a
              href="/dashboard/articles?filter=ai-updates"
              className="bg-white rounded-xl border border-border p-5 hover:border-accent transition-colors"
            >
              <p className="text-2xl font-semibold text-ink">{aiUpdateCount}</p>
              <p className="text-sm text-muted mt-1">AI Article Updates</p>
            </a>
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
        <h2 className="font-serif text-xl text-ink mb-4">Needs attention</h2>
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {needsAttention.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-muted">
                No article feedback yet. Publish more content and collect votes to identify gaps.
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
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-medium ${(article.helpfulRate ?? 0) >= 70 ? 'text-ink' : 'text-accent'}`}>
                      {article.helpfulRate}% helpful
                    </p>
                    <p className="text-xs text-muted">
                      {article.notHelpful} negative / {article.totalVotes} total
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
        <h2 className="font-serif text-xl text-ink mb-4">Recent articles</h2>
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
                {article.status.charAt(0) + article.status.slice(1).toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
