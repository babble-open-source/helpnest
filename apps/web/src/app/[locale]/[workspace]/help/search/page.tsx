import { hasWorkspaceBrandTextColumn, prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { WorkspaceBrandLink } from '@/components/help/WorkspaceBrandLink'

interface Props {
  params: Promise<{ workspace: string }>
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage(props: Props) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams])
  const [t, tc] = await Promise.all([
    getTranslations('search'),
    getTranslations('common'),
  ])
  const brandTextColumnExists = await hasWorkspaceBrandTextColumn()
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace, deletedAt: null },
    select: { id: true, name: true, logo: true },
  })
  if (!workspace) notFound()

  const brandTextRecord = brandTextColumnExists
    ? await prisma.workspace.findUnique({
        where: { id: workspace.id },
        select: { brandText: true },
      })
    : null

  const q = searchParams.q?.trim() ?? ''

  type SearchResult = {
    id: string
    title: string
    slug: string
    excerpt: string | null
    collection_title: string
    collection_slug: string
  }
  const results: SearchResult[] = q.length >= 2
    ? await prisma.$queryRaw<SearchResult[]>`
        SELECT
          a.id, a.title, a.slug, a.excerpt,
          c.title as collection_title,
          c.slug  as collection_slug
        FROM "Article" a
        JOIN "Collection" c ON a."collectionId" = c.id
        WHERE a."workspaceId" = ${workspace.id}
          AND a.status = 'PUBLISHED'
          AND c."isPublic" = true
          AND c."isArchived" = false
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
          <WorkspaceBrandLink
            href={`/${params.workspace}/help`}
            name={workspace.name}
            logo={workspace.logo}
            brandText={brandTextRecord?.brandText ?? null}
            hideNameWhenLogo
            className="shrink-0"
            textClassName="font-serif text-xl text-ink"
          />
          <form method="GET" action="" className="flex-1">
            <input
              name="q"
              defaultValue={q}
              autoFocus
              placeholder={t('placeholder')}
              className="w-full bg-white border border-border rounded-lg px-4 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </form>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {q.length < 2 ? (
          <p className="text-muted text-sm">{t('minChars')}</p>
        ) : results.length === 0 ? (
          <div>
            <p className="text-ink font-medium mb-1">{t('noResults', { query: q })}</p>
            <p className="text-muted text-sm">{t('tryDifferent')}</p>
            <Link
              href={`/${params.workspace}/help`}
              className="inline-block mt-4 text-sm text-accent hover:underline"
            >
              {t('backToHelpCenter')}
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted mb-6">
              {tc('results', { count: results.length })} {t('resultsFor', { query: q })}
            </p>
            <div className="space-y-3">
              {results.map((r: SearchResult) => (
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
