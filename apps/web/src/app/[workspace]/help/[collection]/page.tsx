import { hasWorkspaceBrandTextColumn, prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { WorkspaceBrandLink } from '@/components/help/WorkspaceBrandLink'
import { DashboardButton } from '@/components/help/DashboardButton'

interface Props {
  params: Promise<{ workspace: string; collection: string }>
}

function ReadTime({ content }: { content: string }) {
  const words = content.split(/\s+/).length
  const minutes = Math.max(1, Math.round(words / 200))
  return <span>{minutes} min read</span>
}

export default async function CollectionPage(props: Props) {
  const params = await props.params
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

  const collection = await prisma.collection.findUnique({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: params.collection } },
    include: {
      articles: {
        where: { status: 'PUBLISHED' },
        orderBy: { order: 'asc' },
        include: { author: true },
      },
      subCollections: {
        where: { isPublic: true },
        include: {
          _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
        },
      },
    },
  })
  if (!collection) notFound()

  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-cream/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-2 text-sm">
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
            <span className="text-ink font-medium truncate">{collection.title}</span>
          </div>
          <DashboardButton />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Collection header */}
        <div className="mb-10">
          <div className="text-4xl mb-4">{collection.emoji ?? '📄'}</div>
          <h1 className="font-serif text-4xl text-ink leading-snug mb-3">{collection.title}</h1>
          {collection.description && (
            <p className="text-muted text-lg">{collection.description}</p>
          )}
        </div>

        {/* Sub-collections */}
        {collection.subCollections.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Subcategories</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {collection.subCollections.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/${params.workspace}/help/${sub.slug}`}
                  className="flex items-center gap-3 bg-white border border-border rounded-lg p-3 hover:border-accent transition-colors group"
                >
                  <span className="text-xl">{sub.emoji ?? '📂'}</span>
                  <div>
                    <p className="font-medium text-ink group-hover:text-accent transition-colors">{sub.title}</p>
                    <p className="text-xs text-muted">{sub._count.articles} articles</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Articles */}
        <section>
          {collection.articles.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <p>No articles in this collection yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border divide-y divide-border">
              {collection.articles.map((article) => (
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
                      <ReadTime content={article.content} />
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
