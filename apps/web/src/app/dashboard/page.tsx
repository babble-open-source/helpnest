import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    include: { workspace: true },
  })

  if (!member) {
    return (
      <div className="p-8">
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

  // Total views this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const recentArticles = await prisma.article.findMany({
    where: { workspaceId: member.workspaceId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: { collection: true },
  })

  const stats = [
    { label: 'Total Articles', value: articleCount },
    { label: 'Published', value: publishedCount },
    { label: 'Collections', value: collections },
    { label: 'Draft', value: articleCount - publishedCount },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-ink">Overview</h1>
        <p className="text-muted mt-1">{member.workspace.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-border p-5">
            <p className="text-2xl font-semibold text-ink">{stat.value}</p>
            <p className="text-sm text-muted mt-1">{stat.label}</p>
          </div>
        ))}
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
