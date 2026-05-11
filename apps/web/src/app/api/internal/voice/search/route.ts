import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateInternalSecret } from '@/lib/voice/internal-auth'

export async function GET(request: Request) {
  const authError = validateInternalSecret(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const workspaceId = searchParams.get('workspaceId') ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10), 10)

  if (q.length < 2 || q.length > 200 || !workspaceId) {
    return NextResponse.json({ results: [] })
  }

  type SearchRow = {
    id: string
    title: string
    slug: string
    content: string
    collection_title: string
    collection_slug: string
  }

  const results = await prisma.$queryRaw<SearchRow[]>`
    SELECT a.id, a.title, a.slug, a.content,
      c.title as collection_title, c.slug as collection_slug
    FROM "Article" a
    JOIN "Collection" c ON a."collectionId" = c.id
    WHERE a."workspaceId" = ${workspaceId}
      AND a.status = 'PUBLISHED'
      AND c."visibility"::text = 'PUBLIC'
      AND c."isArchived" = false
      AND (to_tsvector('english', a.title || ' ' || a.content)
           @@ plainto_tsquery('english', ${q}))
    ORDER BY ts_rank(
      to_tsvector('english', a.title || ' ' || a.content),
      plainto_tsquery('english', ${q})
    ) DESC
    LIMIT ${limit}
  `

  const formatted = results.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    content: stripHtml(r.content).slice(0, 3000),
    collectionTitle: r.collection_title,
    collectionSlug: r.collection_slug,
  }))

  return NextResponse.json({ results: formatted })
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}
