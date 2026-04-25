import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { qdrant, COLLECTION_NAME, ensureCollection } from '@/lib/qdrant'
import { embedText } from '@/lib/embeddings'
import { redis } from '@/lib/redis'
import { resolveProvider, isByok } from '@/lib/ai/resolve-provider'
import { checkLimit, incrementUsage } from '@/lib/cloud'
import { getApiVisibility } from '@/lib/help-visibility'

type SearchResultLike = { payload?: Record<string, unknown> | null }
type ArticleRow = {
  id: string
  title: string
  slug: string
  content: string
  collection: { slug: string; title: string }
}
type ContextArticle = ArticleRow & { contextChunk?: string }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const AI_RATE_LIMIT_WINDOW_MS = 60_000
const AI_RATE_LIMIT_MAX_REQUESTS = 20
type RateBucket = { count: number; resetAt: number }
// In-memory fallback — used when Redis is unavailable or not configured.
const aiRateBuckets = new Map<string, RateBucket>()

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip')?.trim()
  return forwardedFor || realIp || 'unknown'
}

function consumeInMemoryRateLimit(key: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now()

  // Best-effort cleanup for long-lived self-hosted processes.
  if (aiRateBuckets.size > 10_000) {
    for (const [k, bucket] of aiRateBuckets) {
      if (bucket.resetAt <= now) aiRateBuckets.delete(k)
    }
  }

  const current = aiRateBuckets.get(key)
  if (!current || current.resetAt <= now) {
    aiRateBuckets.set(key, { count: 1, resetAt: now + AI_RATE_LIMIT_WINDOW_MS })
    return { limited: false, retryAfterSeconds: 0 }
  }

  if (current.count >= AI_RATE_LIMIT_MAX_REQUESTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  current.count += 1
  aiRateBuckets.set(key, current)
  return { limited: false, retryAfterSeconds: 0 }
}

/**
 * Redis-backed sliding-window rate limiter.
 * Falls back to the in-memory implementation if Redis is unavailable.
 */
async function consumeAiRateLimit(key: string): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  if (redis) {
    try {
      const windowSlot = Math.floor(Date.now() / AI_RATE_LIMIT_WINDOW_MS)
      const redisKey = `rl:ai:${key}:${windowSlot}`
      // Pipeline makes INCR + PEXPIRE atomic — avoids a missing TTL if the
      // process crashes between the two calls.
      const [[, count]] = (await redis
        .pipeline()
        .incr(redisKey)
        .pexpire(redisKey, AI_RATE_LIMIT_WINDOW_MS * 2)
        .exec()) as [[null, number], [null, number]]
      if (count > AI_RATE_LIMIT_MAX_REQUESTS) {
        const windowEndMs = (windowSlot + 1) * AI_RATE_LIMIT_WINDOW_MS
        return {
          limited: true,
          retryAfterSeconds: Math.max(1, Math.ceil((windowEndMs - Date.now()) / 1000)),
        }
      }
      return { limited: false, retryAfterSeconds: 0 }
    } catch {
      // Redis error — degrade gracefully to in-memory.
    }
  }
  return consumeInMemoryRateLimit(key)
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  let body: { query?: string; workspaceSlug?: string }
  try {
    body = await request.json() as { query?: string; workspaceSlug?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS_HEADERS })
  }

  const { query, workspaceSlug } = body

  if (!query?.trim() || !workspaceSlug) {
    return NextResponse.json(
      { error: 'query and workspaceSlug are required' },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  const normalizedQuery = query.trim()
  if (normalizedQuery.length > 500) {
    return NextResponse.json(
      { error: 'Query must be 500 characters or fewer' },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  const rateKey = `${getClientIp(request)}:${workspaceSlug}`
  const rate = await consumeAiRateLimit(rateKey)
  if (rate.limited) {
    return NextResponse.json(
      { error: 'Too many AI requests. Please try again shortly.' },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          'Retry-After': String(rate.retryAfterSeconds),
        },
      },
    )
  }

  const workspace = await prisma.workspace.findFirst({
    where: { slug: workspaceSlug },
    select: { id: true, slug: true, name: true, customDomain: true, aiEnabled: true, aiProvider: true, aiApiKey: true, aiModel: true },
  })
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404, headers: CORS_HEADERS })
  }

  if (!workspace.aiEnabled) {
    return NextResponse.json(
      { error: 'AI search is not enabled for this workspace.' },
      { status: 503, headers: CORS_HEADERS },
    )
  }

  // Check AI credit quota — get the plan tier to determine BYOK eligibility.
  // BYOK (skip metering) is allowed for: self-hosted (always), PRO, BUSINESS.
  // Cloud FREE users with a key set are still metered.
  const limit = await checkLimit(workspace.id, 'aiCredits')
  const byokAllowed = limit.plan === 'SELF_HOSTED' || limit.plan === 'PRO' || limit.plan === 'BUSINESS'
  const byok = isByok({ aiApiKey: workspace.aiApiKey }, { byok: byokAllowed })
  if (!byok) {
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'AI credit limit reached for this month. Upgrade your plan or add your own API key.' },
        { status: 429, headers: CORS_HEADERS },
      )
    }
    incrementUsage(workspace.id, 'aiCredits')
  }

  let aiProvider: ReturnType<typeof resolveProvider>
  try {
    aiProvider = resolveProvider({
      aiProvider: workspace.aiProvider,
      aiApiKey: workspace.aiApiKey,
      aiModel: workspace.aiModel,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'AI provider not configured.' },
      { status: 503, headers: CORS_HEADERS },
    )
  }

  const allowedVisibility = await getApiVisibility(request, workspace.id)

  // 1. Embed the query (requires OPENAI_API_KEY; falls back to full-text if unavailable)
  let queryEmbedding: number[] = []
  try {
    queryEmbedding = await embedText(normalizedQuery)
  } catch {
    // fall back to full-text search below
  }

  // 2. Vector search in Qdrant
  let searchResults: SearchResultLike[] = []
  if (queryEmbedding.length > 0) {
    try {
      await ensureCollection()
      // Build Qdrant filter — always scope by workspace. For unauthenticated
      // users, exclude INTERNAL vectors using must_not (rather than requiring
      // visibility=PUBLIC) so that legacy vectors without a visibility field
      // still pass through. The Prisma post-filter provides defense-in-depth.
      const qdrantFilter: {
        must: Array<{ key: string; match: { value: string } }>
        must_not?: Array<{ key: string; match: { value: string } }>
      } = {
        must: [{ key: 'workspaceId', match: { value: workspace.id } }],
      }
      if (!allowedVisibility.includes('INTERNAL')) {
        qdrantFilter.must_not = [{ key: 'visibility', match: { value: 'INTERNAL' } }]
      }
      searchResults = await qdrant.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        limit: 5,
        filter: qdrantFilter,
        with_payload: true,
      })
    } catch {
      // Qdrant unavailable — fall back to full-text
    }
  }

  // 3. Resolve articles in ranked vector order (preserving first chunk per article)
  const seenArticleIds = new Set<string>()
  const vectorMatches: Array<{ articleId: string; chunk?: string }> = []
  for (const result of searchResults) {
    const articleId = result.payload?.['articleId']
    if (typeof articleId !== 'string' || seenArticleIds.has(articleId)) continue
    seenArticleIds.add(articleId)
    const chunk = result.payload?.['chunk']
    vectorMatches.push({
      articleId,
      chunk: typeof chunk === 'string' ? chunk : undefined,
    })
  }

  let articles: ContextArticle[] = []

  if (vectorMatches.length > 0) {
    const articleIds = vectorMatches.map((m) => m.articleId)
    const rows: ArticleRow[] = await prisma.article.findMany({
      where: {
        id: { in: articleIds },
        workspaceId: workspace.id,
        status: 'PUBLISHED',
        collection: { is: { visibility: { in: allowedVisibility }, isArchived: false } },
      },
      select: {
        id: true, title: true, slug: true, content: true,
        collection: { select: { slug: true, title: true } },
      },
    })
    const byId = new Map(rows.map((row) => [row.id, row]))
    const ordered: ContextArticle[] = []
    for (const match of vectorMatches) {
      const row = byId.get(match.articleId)
      if (!row) continue
      ordered.push({
        ...row,
        ...(match.chunk ? { contextChunk: match.chunk } : {}),
      })
    }
    articles = ordered
  } else {
    articles = await prisma.$queryRaw<ContextArticle[]>`
      SELECT a.id, a.title, a.slug, a.content,
             json_build_object('slug', c.slug, 'title', c.title) as collection
      FROM "Article" a
      JOIN "Collection" c ON a."collectionId" = c.id
      WHERE a."workspaceId" = ${workspace.id}
        AND a.status = 'PUBLISHED'
        AND c."visibility"::text = ANY(${allowedVisibility})
        AND c."isArchived" = false
        AND to_tsvector('english', a.title || ' ' || a.content) @@ plainto_tsquery('english', ${normalizedQuery})
      ORDER BY ts_rank_cd(to_tsvector('english', a.title || ' ' || a.content), plainto_tsquery('english', ${normalizedQuery})) DESC
      LIMIT 5
    `
  }

  if (articles.length === 0) {
    return NextResponse.json(
      {
        answer: "I couldn't find any relevant articles for your question. Try browsing the help center or contact our support team.",
        sources: [],
      },
      { headers: CORS_HEADERS },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helpnest.cloud'
  const helpCenterBase = workspace.customDomain
    ? `https://${workspace.customDomain}`
    : `${appUrl}/${workspace.slug}/help`

  const context = articles.map((a, i) => {
    const raw = a.contextChunk ?? a.content.slice(0, 1500)
    const content = raw.trimStart().startsWith('<')
      ? raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : raw
    const articleUrl = `${helpCenterBase}/${a.collection.slug}/${a.slug}`
    return `[Article ${i + 1}]: ${a.title}\nURL: ${articleUrl}\n${content}`
  }).join('\n\n---\n\n')

  const sources = articles.map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    collection: a.collection,
  }))

  // 4. Stream response via workspace-configured provider
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`)
        )
        for await (const event of aiProvider.streamChat({
          model: workspace.aiModel ?? undefined,
          maxTokens: 1024,
          system: `You are a helpful customer support assistant for ${workspace.name}.
Answer questions ONLY using the provided help center articles.
Be concise, friendly, and accurate.
If the articles don't contain enough information, say so and suggest contacting support.
When referencing an article, link to it using the exact URL provided — e.g. [Article Title](URL).
Format your response in markdown.`,
          messages: [{
            role: 'user',
            content: `Help center articles:\n\n${context}\n\nCustomer question: ${query}`,
          }],
        })) {
          if (event.type === 'text') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text', text: event.text })}\n\n`)
            )
          } else if (event.type === 'done') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          } else if (event.type === 'error') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', message: event.message })}\n\n`)
            )
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI service error'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
