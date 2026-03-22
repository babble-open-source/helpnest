import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const workspaceSlug = searchParams.get('workspace') ?? ''

  if (q.length < 2) {
    return NextResponse.json({ results: [] }, { headers: CORS_HEADERS })
  }

  if (q.length > 200) {
    return NextResponse.json({ results: [] }, { headers: CORS_HEADERS })
  }

  const workspace = await prisma.workspace.findFirst({
    where: { slug: workspaceSlug, deletedAt: null },
    select: { id: true },
  })

  if (!workspace) {
    return NextResponse.json({ results: [] }, { headers: CORS_HEADERS })
  }

  // Postgres full-text search using raw query for tsvector.
  // ts_headline generates the snippet server-side, avoiding fetching full content over the wire.
  type SearchRow = {
    id: string
    title: string
    slug: string
    snippet: string
    collection_title: string
    collection_slug: string
    views: number
    word_count: number
  }
  const results: SearchRow[] = await prisma.$queryRaw<SearchRow[]>`
    SELECT
      a.id,
      a.title,
      a.slug,
      COALESCE(
        a.excerpt,
        ts_headline(
          'english',
          a.content,
          plainto_tsquery('english', ${q}),
          'MaxWords=30, MinWords=15, ShortWord=3, HighlightAll=false, MaxFragments=1, FragmentDelimiter='' … '''
        )
      ) AS snippet,
      c.title as collection_title,
      c.slug as collection_slug,
      a.views,
      array_length(regexp_split_to_array(a.content, '\s+'), 1) as word_count
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
    LIMIT 10
  `

  const formatted = results.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    snippet: r.snippet ?? '',
    collection: { title: r.collection_title, slug: r.collection_slug },
    readTime: Math.max(1, Math.round((r.word_count ?? 0) / 200)),
  }))

  return NextResponse.json({ results: formatted }, { headers: CORS_HEADERS })
}
