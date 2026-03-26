import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'
import { uniqueCollectionSlug, uniqueArticleSlug } from '@/lib/unique-slug'
import { resolveProvider } from '@/lib/ai/resolve-provider'
import {
  validateUrl,
  fetchPage,
  extractContent,
  analyzeContent,
  buildArticlePrompt,
  parseArticleResponse,
} from '@helpnest/crawler'
import { createHash } from 'crypto'

export async function POST(request: Request) {
  // 1. Auth check
  const auth = await requireAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (auth.via === 'session' && auth.userId) {
    const member = await prisma.member.findFirst({
      where: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'EDITOR'] },
      },
    })
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { workspaceId, userId } = auth

  // Resolve authorId (API key auth may not carry userId)
  let authorId = userId
  if (!authorId) {
    const member = await prisma.member.findFirst({
      where: { workspaceId },
      select: { userId: true },
      orderBy: { id: 'asc' },
    })
    if (!member) return NextResponse.json({ error: 'No workspace member found' }, { status: 500 })
    authorId = member.userId
  }

  const body = await request.json() as {
    url?: string
    collectionId?: string
  }

  // 2. Validate URL
  const rawUrl = body.url?.trim()
  if (!rawUrl) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  const validation = validateUrl(rawUrl)
  if (!validation.valid || !validation.url) {
    return NextResponse.json({ error: validation.error ?? 'Invalid URL' }, { status: 400 })
  }
  const url = validation.url

  // 3. Get workspace AI settings
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      aiProvider: true,
      aiApiKey: true,
      aiModel: true,
    },
  })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  let provider
  try {
    provider = resolveProvider({
      aiProvider: workspace.aiProvider,
      aiApiKey: workspace.aiApiKey,
      aiModel: workspace.aiModel,
    })
  } catch {
    return NextResponse.json(
      { error: 'No AI provider configured. Set up an AI provider in workspace settings.' },
      { status: 422 },
    )
  }

  // 4. Create CrawlJob record
  const crawlJob = await prisma.crawlJob.create({
    data: {
      workspaceId,
      userId: authorId,
      sourceUrl: url,
      mode: 'SINGLE',
      status: 'CRAWLING',
      totalPages: 1,
    },
  })

  try {
    // 5. Fetch page with Playwright
    const fetchResult = await fetchPage(url)
    if (fetchResult.error || !fetchResult.html) {
      await prisma.crawlJob.update({
        where: { id: crawlJob.id },
        data: { status: 'FAILED', error: fetchResult.error ?? 'Failed to fetch page', completedAt: new Date() },
      })
      return NextResponse.json(
        { error: `Failed to fetch page: ${fetchResult.error ?? 'No HTML returned'}`, crawlJobId: crawlJob.id },
        { status: 502 },
      )
    }

    // 6. Extract content to Markdown
    const extracted = extractContent(fetchResult.html, url)

    // 7. Analyze content
    const analysis = analyzeContent(extracted.markdown, url)

    // Compute a simple content hash for deduplication
    const contentHash = createHash('sha256').update(extracted.markdown).digest('hex').slice(0, 16)

    // 8. Create CrawlPage record
    const crawlPage = await prisma.crawlPage.create({
      data: {
        crawlJobId: crawlJob.id,
        url,
        status: 'EXTRACTED',
        contentHash,
        contentType: analysis.contentType,
        language: analysis.language,
        rawContent: extracted.markdown,
      },
    })

    // 9. If content too short, skip
    if (analysis.tooShort) {
      await prisma.crawlPage.update({
        where: { id: crawlPage.id },
        data: { status: 'SKIPPED', skipReason: 'Content too short (less than 100 characters)' },
      })
      await prisma.crawlJob.update({
        where: { id: crawlJob.id },
        data: { status: 'COMPLETED', processedPages: 1, completedAt: new Date() },
      })
      return NextResponse.json({
        crawlJobId: crawlJob.id,
        skipped: true,
        skipReason: 'Content too short',
        sensitiveDataWarnings: analysis.sensitiveDataWarnings,
      })
    }

    // Update job status to GENERATING
    await prisma.crawlJob.update({
      where: { id: crawlJob.id },
      data: { status: 'GENERATING' },
    })

    // 10. Build AI prompt and stream response
    const existingCollections = await prisma.collection.findMany({
      where: { workspaceId },
      select: { title: true },
    })

    const prompt = buildArticlePrompt({
      markdown: extracted.markdown,
      title: extracted.title,
      url,
      contentType: analysis.contentType,
      workspaceName: workspace.name,
      existingCollections: existingCollections.map((c) => c.title),
    })

    let aiResponseText = ''
    for await (const event of provider.streamChat({
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.userMessage }],
      maxTokens: 4096,
    })) {
      if (event.type === 'text') {
        aiResponseText += event.text
      } else if (event.type === 'error') {
        throw new Error(`AI provider error: ${event.message}`)
      }
    }

    // 11. Parse AI response into ArticleDraft
    const articleDraft = parseArticleResponse(aiResponseText)

    // Update CrawlPage to GENERATED
    await prisma.crawlPage.update({
      where: { id: crawlPage.id },
      data: { status: 'GENERATED' },
    })

    // 12. Resolve collection
    let collectionId = body.collectionId ?? null

    if (!collectionId && articleDraft.suggestedCollection) {
      // Try to find an existing collection matching the AI suggestion
      const match = await prisma.collection.findFirst({
        where: {
          workspaceId,
          title: { equals: articleDraft.suggestedCollection, mode: 'insensitive' },
        },
      })
      if (match) {
        collectionId = match.id
      } else {
        // Create a new collection from the AI suggestion
        const colSlug = await uniqueCollectionSlug(articleDraft.suggestedCollection, workspaceId)
        const newCol = await prisma.collection.create({
          data: { workspaceId, title: articleDraft.suggestedCollection, slug: colSlug },
        })
        collectionId = newCol.id
      }
    }

    if (!collectionId) {
      // Fallback: find or create a "Crawled Pages" collection
      const fallback = await prisma.collection.findFirst({
        where: { workspaceId, slug: 'crawled-pages' },
      })
      if (fallback) {
        collectionId = fallback.id
      } else {
        const colSlug = await uniqueCollectionSlug('Crawled Pages', workspaceId)
        const newCol = await prisma.collection.create({
          data: { workspaceId, title: 'Crawled Pages', slug: colSlug },
        })
        collectionId = newCol.id
      }
    }

    // 13. Create Article with status DRAFT
    const articleSlug = await uniqueArticleSlug(articleDraft.title, workspaceId)
    const article = await prisma.article.create({
      data: {
        workspaceId,
        collectionId,
        authorId,
        title: articleDraft.title,
        slug: articleSlug,
        content: articleDraft.content,
        excerpt: articleDraft.excerpt,
        status: 'DRAFT',
        aiGenerated: true,
        aiPrompt: prompt.userMessage,
      },
    })

    // 14. Update CrawlPage with articleId, purge rawContent
    await prisma.crawlPage.update({
      where: { id: crawlPage.id },
      data: { articleId: article.id, rawContent: null },
    })

    // 15. Update CrawlJob as completed
    await prisma.crawlJob.update({
      where: { id: crawlJob.id },
      data: {
        status: 'COMPLETED',
        processedPages: 1,
        articlesCreated: 1,
        completedAt: new Date(),
      },
    })

    // 16. Return result
    return NextResponse.json({
      crawlJobId: crawlJob.id,
      skipped: false,
      article: {
        id: article.id,
        title: article.title,
        slug: article.slug,
        collectionId: article.collectionId,
        excerpt: articleDraft.excerpt,
        confidence: articleDraft.confidence,
      },
      contentType: analysis.contentType,
      sensitiveDataWarnings: analysis.sensitiveDataWarnings,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.crawlJob.update({
      where: { id: crawlJob.id },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    }).catch(() => {
      // Ignore update failure — the original error is more important
    })
    return NextResponse.json(
      { error: `Crawl failed: ${message}`, crawlJobId: crawlJob.id },
      { status: 500 },
    )
  }
}
