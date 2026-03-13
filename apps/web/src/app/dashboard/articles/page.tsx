import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isDemoMode } from '@/lib/demo'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { GenerateTopicButton } from './GenerateTopicButton'
import { ArticlesTable } from './ArticlesTable'

export default async function ArticlesPage(props: {
  searchParams: Promise<{ status?: string; collection?: string; q?: string; filter?: string }>
}) {
  const [session, searchParams] = await Promise.all([auth(), props.searchParams])
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
      ? { title: { contains: searchParams.q, mode: 'insensitive' as const } }
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
          <h1 className="font-serif text-2xl sm:text-3xl text-ink">Articles</h1>
          <p className="text-muted text-sm mt-1">
            {articles.length} article{articles.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <GenerateTopicButton />
          <Link
            href="/dashboard/articles/new"
            className="bg-ink text-cream px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium shrink-0"
          >
            + New Article
          </Link>
        </div>
      </div>

      {/* Status tabs including AI filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[
          { label: 'All', href: '/dashboard/articles', active: !searchParams.status && !searchParams.filter },
          { label: 'Published', href: '/dashboard/articles?status=PUBLISHED', active: searchParams.status === 'PUBLISHED' },
          { label: 'Draft', href: '/dashboard/articles?status=DRAFT', active: searchParams.status === 'DRAFT' },
          { label: 'Archived', href: '/dashboard/articles?status=ARCHIVED', active: searchParams.status === 'ARCHIVED' },
          ...(aiDraftCount > 0 ? [{ label: `AI Drafts (${aiDraftCount})`, href: '/dashboard/articles?filter=ai-drafts', active: aiDraftsFilter }] : []),
          ...(aiUpdateCount > 0 ? [{ label: `AI Updates (${aiUpdateCount})`, href: '/dashboard/articles?filter=ai-updates', active: aiUpdatesFilter }] : []),
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
        <form className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2 w-full sm:w-auto">
          <svg
            className="w-4 h-4 text-muted shrink-0"
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
            className="text-sm outline-none text-ink placeholder:text-muted bg-transparent flex-1 sm:w-48"
          />
        </form>
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
        <ArticlesTable articles={articles} demoMode={demoMode} />
      )}
    </div>
  )
}
