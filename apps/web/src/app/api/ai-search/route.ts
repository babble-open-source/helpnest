import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { qdrant, COLLECTION_NAME, ensureCollection } from '@/lib/qdrant'
import { embedText } from '@/lib/embeddings'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
})

export async function POST(request: Request) {
  const { query, workspaceSlug } = await request.json() as {
    query: string
    workspaceSlug: string
  }

  if (!query?.trim() || !workspaceSlug) {
    return NextResponse.json({ error: 'query and workspaceSlug are required' }, { status: 400 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true },
  })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  // 1. Embed the query
  let queryEmbedding: number[] = []
  try {
    queryEmbedding = await embedText(query)
  } catch {
    // will fall back to full-text
  }

  // 2. Vector search in Qdrant
  await ensureCollection()
  let searchResults: Array<{ payload?: Record<string, unknown> }> = []
  if (queryEmbedding.length > 0) {
    try {
      searchResults = await qdrant.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        limit: 5,
        filter: { must: [{ key: 'workspaceId', match: { value: workspace.id } }] },
        with_payload: true,
      })
    } catch {
      // Qdrant unavailable — fall back
    }
  }

  // 3. Resolve articles
  const articleIds = [...new Set(
    searchResults
      .map((r) => r.payload?.['articleId'] as string | undefined)
      .filter((id): id is string => !!id)
  )]

  type ArticleRow = {
    id: string
    title: string
    slug: string
    content: string
    collection: { slug: string; title: string }
  }

  let articles: ArticleRow[] = []

  if (articleIds.length > 0) {
    const rows = await prisma.article.findMany({
      where: { id: { in: articleIds }, status: 'PUBLISHED' },
      select: {
        id: true, title: true, slug: true, content: true,
        collection: { select: { slug: true, title: true } },
      },
      take: 5,
    })
    articles = rows
  } else {
    articles = await prisma.$queryRaw<ArticleRow[]>`
      SELECT a.id, a.title, a.slug, a.content,
             json_build_object('slug', c.slug, 'title', c.title) as collection
      FROM "Article" a
      JOIN "Collection" c ON a."collectionId" = c.id
      WHERE a."workspaceId" = ${workspace.id}
        AND a.status = 'PUBLISHED'
        AND to_tsvector('english', a.title || ' ' || a.content) @@ plainto_tsquery('english', ${query})
      LIMIT 5
    `
  }

  if (articles.length === 0) {
    return NextResponse.json({
      answer: "I couldn't find any relevant articles for your question. Try browsing the help center or contact our support team.",
      sources: [],
    })
  }

  const context = articles.map((a, i) => {
    const chunk = searchResults[i]?.payload?.['chunk'] as string | undefined
    const content = chunk ?? a.content.slice(0, 1500)
    return `[Article ${i + 1}]: ${a.title}\n${content}`
  }).join('\n\n---\n\n')

  const sources = articles.map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    collection: a.collection,
  }))

  // 4. Stream Claude response
  const stream = anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `You are a helpful customer support assistant for ${workspace.name}.
Answer questions ONLY using the provided help center articles.
Be concise, friendly, and accurate.
If the articles don't contain enough information, say so and suggest contacting support.
Format your response in plain text (no markdown).`,
    messages: [{
      role: 'user',
      content: `Help center articles:\n\n${context}\n\nCustomer question: ${query}`,
    }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`)
      )
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'text', text: chunk.delta.text })}\n\n`)
          )
        }
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
