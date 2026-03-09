import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: { workspace: string }
  searchParams: { q?: string }
}

export default async function SearchPage({ params, searchParams }: Props) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace },
    select: { id: true, name: true },
  })
  if (!workspace) notFound()

  const q = searchParams.q?.trim() ?? ''

  const results = q.length >= 2
    ? await prisma.$queryRaw<Array<{
        id: string
        title: string
        slug: string
        excerpt: string | null
        collection_title: string
        collection_slug: string
      }>>`
        SELECT
          a.id, a.title, a.slug, a.excerpt,
          c.title as collection_title,
          c.slug  as collection_slug
        FROM "Article" a
        JOIN "Collection" c ON a."collectionId" = c.id
        WHERE a."workspaceId" = ${workspace.id}
          AND a.status = 'PUBLISHED'
          AND c."isPublic" = true
          AND (
            to_tsvector('english', a.title || ' ' || a.content)
            @@ plainto_tsquery('english', ${q})
          )
        ORDER BY
          ts_rank(
            to_tsvector('english', a.title || ' ' || a.content),
            plainto_tsquery('english', ${q})
          ) DESC
        LIMIT 20
      `
    : []

  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-cream/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href={`/${params.workspace}/help`} className="font-serif text-xl text-ink shrink-0">
            {workspace.name}
          </Link>
          <form method="GET" action="" className="flex-1">
            <input
              name="q"
              defaultValue={q}
              autoFocus
              placeholder="Search articles..."
              className="w-full bg-white border border-border rounded-lg px-4 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </form>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {q.length < 2 ? (
          <p className="text-muted text-sm">Type at least 2 characters to search.</p>
        ) : results.length === 0 ? (
          <div>
            <p className="text-ink font-medium mb-1">No results for &ldquo;{q}&rdquo;</p>
            <p className="text-muted text-sm">Try different keywords or browse collections.</p>
            <Link
              href={`/${params.workspace}/help`}
              className="inline-block mt-4 text-sm text-accent hover:underline"
            >
              &larr; Back to help center
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted mb-6">
              {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
            </p>
            <div className="space-y-3">
              {results.map((r) => (
                <Link
                  key={r.id}
                  href={`/${params.workspace}/help/${r.collection_slug}/${r.slug}`}
                  className="block bg-white rounded-xl border border-border p-5 hover:border-accent hover:shadow-sm transition-all group"
                >
                  <p className="font-medium text-ink group-hover:text-accent transition-colors mb-1">
                    {r.title}
                  </p>
                  {r.excerpt && (
                    <p className="text-sm text-muted line-clamp-2 mb-2">{r.excerpt}</p>
                  )}
                  <span className="text-xs text-muted bg-cream rounded-full px-2 py-0.5">
                    {r.collection_title}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
