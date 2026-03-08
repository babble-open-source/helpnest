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

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true },
  })

  if (!workspace) {
    return NextResponse.json({ results: [] }, { headers: CORS_HEADERS })
  }

  // Postgres full-text search using raw query for tsvector
  const results = await prisma.$queryRaw<
    Array<{
      id: string
      title: string
      slug: string
      excerpt: string | null
      content: string
      collection_title: string
      collection_slug: string
      views: number
    }>
  >`
    SELECT
      a.id,
      a.title,
      a.slug,
      a.excerpt,
      a.content,
      c.title as collection_title,
      c.slug as collection_slug,
      a.views
    FROM "Article" a
    JOIN "Collection" c ON a."collectionId" = c.id
    WHERE a."workspaceId" = ${workspace.id}
      AND a.status = 'PUBLISHED'
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

  const formatted = results.map((r) => {
    // Extract a snippet around the match
    const lowerContent = r.content.toLowerCase()
    const lowerQ = q.toLowerCase()
    const idx = lowerContent.indexOf(lowerQ)
    let snippet = r.excerpt ?? ''
    if (!snippet && idx !== -1) {
      const start = Math.max(0, idx - 60)
      const end = Math.min(r.content.length, idx + q.length + 120)
      snippet =
        (start > 0 ? '…' : '') +
        r.content.slice(start, end) +
        (end < r.content.length ? '…' : '')
    }

    const words = r.content.split(/\s+/).length
    const readTime = Math.max(1, Math.round(words / 200))

    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      snippet,
      collection: { title: r.collection_title, slug: r.collection_slug },
      readTime,
    }
  })

  return NextResponse.json({ results: formatted }, { headers: CORS_HEADERS })
}
