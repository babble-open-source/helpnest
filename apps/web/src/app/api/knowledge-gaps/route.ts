import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

// GET — List knowledge gaps for the authenticated workspace.
//
// Query params:
//   resolved=true  → return resolved gaps (resolvedAt IS NOT NULL)
//   resolved=false (default) → return open gaps (resolvedAt IS NULL)
//   page, limit    → cursor-free pagination; gaps are sorted by occurrence
//                    count descending so the most impactful ones surface first.
export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const resolved = url.searchParams.get('resolved') === 'true'
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { workspaceId: authResult.workspaceId }
  // Filter by resolution state — the resolved flag determines which half of the
  // learning loop dashboard is being viewed.
  if (resolved) {
    where.resolvedAt = { not: null }
  } else {
    where.resolvedAt = null
  }

  const [gaps, total] = await Promise.all([
    prisma.knowledgeGap.findMany({
      where,
      orderBy: { occurrences: 'desc' },
      skip,
      take: limit,
      include: {
        resolvedBy: { select: { name: true, email: true } },
        resolvedArticle: { select: { id: true, title: true, slug: true } },
      },
    }),
    prisma.knowledgeGap.count({ where }),
  ])

  return NextResponse.json({ data: gaps, total, page, limit })
}

// PATCH — Mark a knowledge gap as resolved.
//
// Optionally links the resolving article so the dashboard can show "resolved
// by writing <article title>". The resolvedById is taken from the auth token
// so the client cannot forge attribution.
export async function PATCH(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Session auth carries userId; API key auth does not. Resolving via API key
  // is allowed but resolvedById will be null — the attribution is omitted
  // rather than blocked.
  const resolverId = authResult.userId ?? null

  let body: { id?: string; articleId?: string }
  try {
    body = (await request.json()) as { id?: string; articleId?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Scope to workspace to prevent cross-tenant resolution via a guessed ID.
  const gap = await prisma.knowledgeGap.findFirst({
    where: { id: body.id, workspaceId: authResult.workspaceId },
    select: { id: true, resolvedAt: true },
  })
  if (!gap) {
    return NextResponse.json({ error: 'Knowledge gap not found' }, { status: 404 })
  }

  // Idempotent — re-resolving is harmless; we update the timestamp and article link.
  const updated = await prisma.knowledgeGap.update({
    where: { id: body.id },
    data: {
      resolvedAt: new Date(),
      resolvedById: resolverId,
      resolvedArticleId: body.articleId ?? null,
    },
  })

  return NextResponse.json(updated)
}
