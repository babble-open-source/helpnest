import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isDemoMode } from '@/lib/demo'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArticleActions } from './ArticleActions'

function nowMs() { return Date.now() }

const STATUS_STYLES = {
  PUBLISHED: 'bg-green/10 text-green',
  DRAFT: 'bg-cream text-muted border border-border',
  ARCHIVED: 'bg-border/50 text-muted',
}

function feedbackSummary(helpful: number, notHelpful: number) {
  const total = helpful + notHelpful
  const helpfulRate = total === 0 ? null : Math.round((helpful / total) * 100)

  return { total, helpfulRate }
}

export default async function ArticlesPage(props: {
  searchParams: Promise<{ status?: string; collection?: string; q?: string }>
}) {
  const [session, searchParams] = await Promise.all([auth(), props.searchParams])
  if (!session?.user) redirect('/login')

  const demoMode = isDemoMode()

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspaceId: true },
  })
  if (!member) redirect('/dashboard')

  const where = {
    workspaceId: member.workspaceId,
    ...(searchParams.status
      ? { status: searchParams.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }
      : {}),
    ...(searchParams.collection ? { collectionId: searchParams.collection } : {}),
    ...(searchParams.q
      ? { title: { contains: searchParams.q, mode: 'insensitive' as const } }
      : {}),
  }

  const articles = await prisma.article.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { collection: true, author: true },
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-ink">Articles</h1>
          <p className="text-muted text-sm mt-1">
            {articles.length} article{articles.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/dashboard/articles/new"
          className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium"
        >
          + New Article
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
          <svg
            className="w-4 h-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search articles..."
            className="text-sm outline-none text-ink placeholder:text-muted bg-transparent w-48"
          />
        </form>

        <div className="flex items-center gap-2">
          {(['', 'DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map((s) => (
            <Link
              key={s}
              href={`/dashboard/articles${s ? `?status=${s}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                (searchParams.status ?? '') === s
                  ? 'bg-ink text-cream'
                  : 'text-muted hover:text-ink hover:bg-cream'
              }`}
            >
              {s || 'All'}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      {articles.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="font-medium text-ink mb-1">No articles yet</p>
          <p className="text-muted text-sm mb-4">
            Create your first article to get started
          </p>
          <Link
            href="/dashboard/articles/new"
            className="text-accent hover:underline text-sm"
          >
            Create article →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">
                  Title
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden sm:table-cell">
                  Collection
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden md:table-cell">
                  Views
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden lg:table-cell">
                  Feedback
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden lg:table-cell">
                  Updated
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-cream/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink text-sm truncate max-w-xs">
                      {article.title}
                    </p>
                    {article.excerpt && (
                      <p className="text-xs text-muted mt-0.5 truncate max-w-xs">
                        {article.excerpt}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-muted">{article.collection.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        STATUS_STYLES[article.status]
                      }`}
                    >
                      {article.status.charAt(0) + article.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-sm text-muted">
                      {article.views.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    {(() => {
                      const summary = feedbackSummary(article.helpful, article.notHelpful)

                      if (summary.total === 0) {
                        return <span className="text-sm text-muted">No votes</span>
                      }

                      const rateTone =
                        (summary.helpfulRate ?? 0) >= 80
                          ? 'text-green'
                          : (summary.helpfulRate ?? 0) >= 60
                            ? 'text-ink'
                            : 'text-accent'

                      return (
                        <div className="space-y-0.5">
                          <p className={`text-sm font-medium ${rateTone}`}>
                            {summary.helpfulRate}% helpful
                          </p>
                          <p className="text-xs text-muted">
                            {summary.total} vote{summary.total === 1 ? '' : 's'}
                          </p>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className="text-sm text-muted">
                      {new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
                        Math.round(
                          (article.updatedAt.getTime() - nowMs()) /
                            (1000 * 60 * 60 * 24)
                        ),
                        'day'
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ArticleActions
                      articleId={article.id}
                      articleTitle={article.title}
                      articleStatus={article.status}
                      demoMode={demoMode}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
